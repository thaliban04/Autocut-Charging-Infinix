# START

sleep 0.5
ui_print " "
ui_print "  █████╗ ██╗   ██╗████████╗██████╗  ██████╗██╗   ██╗████████╗"
ui_print " ██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗██╔════╝██║   ██║╚══██╔══╝"
ui_print " ███████║██║   ██║   ██║   ██║   ██║██║     ██║   ██║   ██║   "
ui_print " ██╔══██║██║   ██║   ██║   ██║   ██║██║     ██║   ██║   ██║   "
ui_print " ██║  ██║╚██████╔╝   ██║   ╚██████╔╝╚██████╗╚██████╔╝   ██║   "
ui_print " ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝  ╚═════╝ ╚═════╝    ╚═╝   "
ui_print " "
ui_print "        ⚡ A U T O C U T   C H A R G I N G   [ v 1 . 0 . 0 ] ⚡      "
ui_print "             Premium Battery Management by thaliban04        "
ui_print " "
ui_print " ─────────────────────────────────────────────────────────── "
ui_print " "

# Install toast app for notifications
ui_print " [ + ] Checking system dependencies..."
if pm list packages | grep -q "bellavita.toast"; then
    ui_print "       └─ Toast notification app is already installed."
else
    ui_print "       └─ Installing lightweight notification app..."
    pm install "$MODPATH/toast.apk" > /dev/null 2>&1
    pm list packages | grep -q "bellavita.toast" \
        && ui_print "          └─ Installed successfully." \
        || ui_print "          └─ Could not install (Fallback to standard alerts)."
fi

ui_print " "
# Set up config — config lives in MODPATH (/data/adb/modules/AutocutChargingAI/)
ui_print " [ + ] Configuring smart engine modules..."
if [ ! -f "$MODPATH/autocut.conf" ]; then
    ui_print "       └─ Generating fresh configuration..."
    # autocut.conf is already extracted to MODPATH by the ZIP installer
else
    # Check if old format (single char "0" or "1")
    local conf_size
    conf_size=$(wc -c < "$MODPATH/autocut.conf" 2>/dev/null || echo 0)
    if [ "$conf_size" -le 2 ]; then
        # Old format — restore default
        cp -f "$MODPATH/autocut.conf.bak" "$MODPATH/autocut.conf" 2>/dev/null || true
        ui_print "       └─ Upgraded legacy configuration to v1.0.0."
    else
        ui_print "       └─ Preserved existing user preferences."
    fi
fi

ui_print " "
ui_print " [ ✔ ] Setup complete! Open your KernelSU WebUI to configure."
ui_print " "

# Initialize log
[ -f "$MODPATH/autocut.log" ] || \
    echo "$(date '+%Y-%m-%d %H:%M:%S') | INFO: Autocut Charging v1.0.0 installed" \
    > "$MODPATH/autocut.log"

ui_print " "
ui_print "  WebUI available in KernelSU/APatch action panel."
ui_print "  Config stored in: /data/adb/modules/AutocutChargingAI/"
ui_print " "

# END
