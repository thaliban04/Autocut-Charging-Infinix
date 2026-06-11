<h1 align="center">Autocut Charging</h1>

<p align="center">
  <strong>Smart Battery Management & True Hardware Bypass for Rooted Android Devices</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Root-KernelSU%20%7C%20APatch%20%7C%20Magisk-success?style=for-the-badge&logo=android" alt="Supported Root Solutions">
  <img src="https://img.shields.io/badge/Version-v1.0.0-blue?style=for-the-badge" alt="Version">
</p>

---

**Autocut Charging** is an advanced, fully automated battery protection module designed to maximize your device's battery lifespan. It seamlessly interrupts charging at customizable thresholds to prevent overcharging and overheating. 

Specially optimized for **Infinix Note 30** and modern MediaTek devices, it features **True Hardware Bypass Charging**, allowing you to play heavy games while running directly on wall power without degrading your battery!

## Key Features

- **Smart Auto-Cutoff**: Set different battery thresholds for when you are using the phone (Screen ON) vs when you are sleeping (Screen OFF).
- **Per-App Hardware Bypass**: Select specific apps or games. When launched, the module activates true hardware bypass (`bypass_charger` node)—powering the CPU directly from the charger without micro-cycling the battery.
- **Temperature Guard**: Automatically pauses charging if your battery exceeds safe temperature limits.
- **Premium WebUI**: A beautiful, minimalist, glassmorphic configuration dashboard built directly into KernelSU/APatch. No need to edit text files manually!
- **Live Status Monitoring**: Watch your battery percentage, temperature, and active charging state update in real-time inside the WebUI.
- **Native Notifications**: Get instant Android Toast popups and system notifications whenever the charging state changes.
- **Zero Background Drain**: Built using highly optimized shell scripts that consume near-zero RAM and CPU.

## Screenshots

> **Note to Developer:** *Drag and drop a screenshot of your KernelSU WebUI here when editing on GitHub!*

## WebUI Dashboard

The module comes with a built-in modern dashboard accessible via the Action Menu in KernelSU or APatch. 

**UI Capabilities include:**
- Master Enable/Disable Switch (Auto-saves instantly)
- Interactive Sliders for Screen ON/OFF Cutoff Thresholds
- Interactive Slider for Resume Charging Threshold
- Interactive Slider for Maximum Temperature
- **Per-App Selector**: Search and select installed apps to trigger Hardware Bypass Mode.

## Requirements

- **Root Access**: KernelSU, APatch, or Magisk.
- **WebUI Access**: Only KernelSU and APatch currently support the built-in WebUI interface. (Magisk users will need to edit `/data/adb/modules/AutocutChargingAI/autocut.conf` manually).
- **Compatibility**: Tested extensively on Infinix Note 30 (MediaTek). Works on most standard Android charging implementations.

## Installation

1. Download the latest `AutocutCharging-v1.0.0.zip` from the [Releases](https://github.com/thaliban04/Autocut-Charging-Infinix/releases) page.
2. Open your Root Manager (KernelSU, APatch, or Magisk).
3. Go to the **Modules** tab.
4. Click **Install from Storage** and select the `.zip` file.
5. Reboot your device.
6. Open your Root Manager again, tap on the **Autocut Charging** module to open the WebUI, and configure your preferences!

## License

This project is licensed under the **GNU General Public License v2.0**. You are free to modify and distribute it as long as it remains open-source.
