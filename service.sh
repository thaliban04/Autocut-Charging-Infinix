#!/system/bin/sh

# Autocut Charging by thaliban04 — service.sh v1.0.0
# Fix: Reverted to v1.0.0 logic (which explicitly uses charger/online and works perfectly)

VCONF_FILE="$MODPATH/autocut.conf"
VLOG_FILE="$MODPATH/autocut.log"

# Defaults
ENABLED=1
THRESHOLD_SCREEN_OFF=85
THRESHOLD_SCREEN_ON=75
RESUME_LEVEL=70
TEMP_LIMIT=45
CURRENT_LIMIT=0
NOTIFY=1
POLL_INTERVAL=60

[ -f "$VLOG_FILE" ] || touch "$VLOG_FILE"

vlog() { echo "$(date '+%Y-%m-%d %H:%M:%S') | $1" >> "$VLOG_FILE"; }

vload_config() {
    [ -f "$VCONF_FILE" ] || return
    while IFS='=' read -r k v; do
        case "$k" in '#'*|'') continue ;; esac
        k=$(echo "$k" | tr -d ' \t')
        v=$(echo "$v" | sed 's/#.*//' | tr -d ' \t')
        [ -z "$k" ] || [ -z "$v" ] && continue
        case "$k" in
            ENABLED)              ENABLED="$v" ;;
            THRESHOLD_SCREEN_OFF) THRESHOLD_SCREEN_OFF="$v" ;;
            THRESHOLD_SCREEN_ON)  THRESHOLD_SCREEN_ON="$v" ;;
            RESUME_LEVEL)         RESUME_LEVEL="$v" ;;
            TEMP_LIMIT)           TEMP_LIMIT="$v" ;;
            CURRENT_LIMIT)        CURRENT_LIMIT="$v" ;;
            NOTIFY)               NOTIFY="$v" ;;
            POLL_INTERVAL_CHARGING) POLL_INTERVAL="$v" ;;
            BYPASS_APPS)          BYPASS_APPS="$v" ;;
        esac
    done < "$VCONF_FILE"
}

vupdate_desc() {
    sed -Ei "s/^description=(\[.*\][[:space:]]*)?/description=[ $1 ] /g" \
        "$MODPATH/module.prop" 2>/dev/null
}

vnotify() {
    vupdate_desc "$1"
    [ "$NOTIFY" = "1" ] || return
    am start -a android.intent.action.MAIN -e toasttext "$1" -n bellavita.toast/.MainActivity >/dev/null 2>&1
    su -lp 2000 -c "cmd notification post -S bigtext -t 'Autocut Charging' tag '$1'" >/dev/null 2>&1
}

# Confirmed working paths
VCHARGE_PATH="/sys/class/power_supply/charger/online"
VBYPASS_PATH="/sys/devices/platform/charger/bypass_charger"
VCURRENT_MAX_PATH="/sys/class/power_supply/charger/constant_charge_current"

VSTATS_FILE="$MODPATH/bat_stats.csv"
[ -f "$VSTATS_FILE" ] || echo "time,battery,temp" > "$VSTATS_FILE"

vlog_stats() {
    local t
    t=$(date '+%H:%M')
    echo "$t,$1,$2" >> "$VSTATS_FILE"
    tail -n 61 "$VSTATS_FILE" > "${VSTATS_FILE}.tmp"
    mv "${VSTATS_FILE}.tmp" "$VSTATS_FILE"
}

vapply_current_limit() {
    # If 0, write a high value to reset (e.g. 3000mA = 3A) or ignore
    local val=3000000
    [ "$CURRENT_LIMIT" -gt 0 ] 2>/dev/null && val=$(( CURRENT_LIMIT * 1000 ))
    echo "$val" > "$VCURRENT_MAX_PATH" 2>/dev/null
}

# Standard cutoff (uses online node)
vcut()    { echo 0 > "$VCHARGE_PATH" 2>/dev/null; }
vresume() { echo 1 > "$VCHARGE_PATH" 2>/dev/null; }

# Hardware bypass (uses bypass node)
vbypass_on()  { echo 1 > "$VBYPASS_PATH" 2>/dev/null; }
vbypass_off() { echo 0 > "$VBYPASS_PATH" 2>/dev/null; }

vget_bat()    { cat /sys/class/power_supply/battery/capacity 2>/dev/null || echo 50; }
vget_temp()   { 
    local r; r=$(cat /sys/class/power_supply/battery/temp 2>/dev/null || echo 250)
    echo $((r / 10))
}
vget_status() { cat /sys/class/power_supply/battery/status 2>/dev/null || echo Unknown; }

vis_screen_off() {
    local w; w=$(dumpsys power 2>/dev/null | grep -i "mWakefulness=" | head -1)
    case "$w" in *Asleep*|*Dozing*) return 0 ;; *Awake*) return 1 ;; esac
    # Fallback (same as original)
    [ "$(dumpsys window 2>/dev/null | grep "mScreenOn" | grep false)" ]
}

vwrite_flag() { echo "$VCUT_ACTIVE" > "$MODPATH/cut_active" 2>/dev/null; }

vlog "INFO: Autocut Charging v1.0.0 started"
vload_config
vlog "INFO: ScreenOff=${THRESHOLD_SCREEN_OFF}% ScreenOn=${THRESHOLD_SCREEN_ON}% Resume=${RESUME_LEVEL}% Temp=${TEMP_LIMIT}°C"

VCUT_ACTIVE=0
vwrite_flag

while true; do
    vload_config

    BAT=$(vget_bat)
    TEMP=$(vget_temp)
    STATUS=$(vget_status)
    vwrite_flag

    # Disabled
    if [ "$ENABLED" != "1" ]; then
        if [ "$VCUT_ACTIVE" = "1" ]; then
            vresume; VCUT_ACTIVE=0; vwrite_flag
        elif [ "$VCUT_ACTIVE" = "2" ]; then
            vbypass_off; VCUT_ACTIVE=0; vwrite_flag
        fi
        vupdate_desc "Disabled | ${BAT}%"
        sleep 120; continue
    fi

    # Bypass App Detection
    FORCE_CUT=0
    if [ -n "$BYPASS_APPS" ] && [ "$BYPASS_APPS" != "none" ]; then
        FG_APP=$(dumpsys window 2>/dev/null | grep -m 1 "mCurrentFocus" | cut -d '/' -f 1 | rev | cut -d ' ' -f 1 | rev)
        if [ -n "$FG_APP" ]; then
            # Check if FG_APP is in BYPASS_APPS (comma separated)
            IFS=','
            for app in $BYPASS_APPS; do
                if [ "$app" = "$FG_APP" ]; then
                    FORCE_CUT=1
                    break
                fi
            done
            unset IFS
        fi
    fi

    if [ "$FORCE_CUT" = "1" ]; then
        if [ "$VCUT_ACTIVE" != "2" ]; then
            vresume # Ensure normal charger is online before hardware bypass
            vbypass_on
            VCUT_ACTIVE=2; vwrite_flag
            vlog "INFO: Hardware Bypass active for $FG_APP"
            vnotify "Bypass Mode Active"
        else
            vbypass_on # Re-apply to prevent hardware auto-resume
        fi
        vupdate_desc "Bypass: $FG_APP | ${BAT}% | ${TEMP}°C"
        sleep "$POLL_INTERVAL"
        continue
    fi

    # Exited bypass mode
    if [ "$VCUT_ACTIVE" = "2" ]; then
        vbypass_off
        VCUT_ACTIVE=0; vwrite_flag
        vlog "INFO: Bypass ended. Restoring standard logic."
    fi

    # Screen-based threshold (same logic as original)
    vis_screen_off && TH="$THRESHOLD_SCREEN_OFF" || TH="$THRESHOLD_SCREEN_ON"

    if [ "$VCUT_ACTIVE" = "1" ]; then
        # Resume when battery drops to resume level
        if [ "$BAT" -le "$RESUME_LEVEL" ] 2>/dev/null; then
            vresume
            VCUT_ACTIVE=0; vwrite_flag
            vlog "INFO: Resume at ${BAT}% (resume=${RESUME_LEVEL}%)"
            vnotify "Charging resumed (${BAT}%)"
        else
            # Re-apply cut every cycle — handles hardware auto-re-enable
            vcut
            vupdate_desc "Paused: ${BAT}% | ${TEMP}°C"
        fi
    elif [ "$STATUS" = "Charging" ]; then
        # Temperature protection
        if [ "$TEMP" -ge "$TEMP_LIMIT" ] 2>/dev/null; then
            vcut; VCUT_ACTIVE=1; vwrite_flag
            vlog "WARN: Temp ${TEMP}°C >= ${TEMP_LIMIT}°C — cut"
            vnotify "⚠ Too hot (${TEMP}°C) — charging paused"
        # Threshold cut (same condition as original)
        elif [ "$BAT" -ge "$TH" ] 2>/dev/null; then
            vcut; VCUT_ACTIVE=1; vwrite_flag
            vlog "INFO: Cut at ${BAT}% (threshold ${TH}%)"
            vnotify "Charging paused at ${BAT}%"
        else
            vupdate_desc "Charging: ${BAT}% → ${TH}% | ${TEMP}°C"
        fi
    else
        vupdate_desc "Standby | ${BAT}% | ${TEMP}°C"
    fi

    # Log stats for WebUI Chart
    vlog_stats "$BAT" "$TEMP"

    # Apply Current Limiter if charging
    if [ "$STATUS" = "Charging" ] && [ "$VCUT_ACTIVE" = "0" ]; then
        vapply_current_limit
    fi

    sleep "$POLL_INTERVAL"
done &
