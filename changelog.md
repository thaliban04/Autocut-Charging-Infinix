## v1.0.0
- Complete service.sh rewrite with adaptive polling (saves CPU)
- Added resume charging: auto re-enable when battery drops below threshold
- Added temperature protection: pause charging if battery too hot
- Added auto-detection for charger control path (multi-device support)
- Added log rotation (max 500 lines, no more bloated log files)
- New multi-parameter config format (key=value with comments)
- Config is preserved on module update (no more settings reset)
- Added KernelSU/APatch WebUI with live battery status, sliders, log viewer
- Service writes status JSON for WebUI real-time display
- Removed auto-open Telegram on install

## v1.0.0
- Initial release