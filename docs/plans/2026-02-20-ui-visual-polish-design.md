# UI Visual Polish Design

## Problem
The web UI is functional but visually bare — all text, no icons, no graphical status indicators. It reads like a prototype rather than a polished dashboard.

## Solution
Add lucide-react icons throughout and upgrade visual indicators across all components.

## Changes

### StatusBar
- Gear icon replaces "Settings" text
- Wifi/WifiOff icon for connection status
- Status badge pill with icon: red Square for stopped, green Play for playing, yellow Pause for paused

### PlaybackControls
- Icon buttons: Square (stop), Play, Pause — replacing text labels
- Session info bar above progress showing session name, circuit, type
- Playhead dot on progress bar at current position

### SessionSelector
- Film icon on session buttons
- Better session cards showing circuit + date + type
- More engaging empty state with icon and guidance text

### DriverCards
- Trophy/medal styling for podium positions (P1-P3)
- Pit lane icon (CircleDot or Wrench) replacing PIT text badge

### EventFeed
- Icons per event type: Flag for flag_change, ArrowRightLeft for overtake, Wrench for pit_stop, CloudRain for weather
- Replace text type labels

### Dependencies
- lucide-react (tree-shakeable, only ships icons used)
