# ClaudeCron

Command-line scheduler for running Claude CLI prompts in the background.

## Install

```bash
npm install -g @marvelcollin/claudecron
claudecron
```

Run Claude CLI login first if Claude is not authenticated yet.

```bash
claude auth
```

## Manage Schedule

```bash
claudecron
```

Use the arrow keys to choose `Configure Schedule`, `Run Background`, `Stop Background`, `Run once now`, or `Open log`. The menu shows whether the background schedule is on, whether a run is active, the last run time, the next run time, and run counts.

## Config Tutorial

On first run, ClaudeCron creates `claudecron.config.json` in your user app data folder.

Windows:

```text
%APPDATA%\ClaudeCron\claudecron.config.json
```

macOS:

```text
~/Library/Application Support/ClaudeCron/claudecron.config.json
```

Use `Configure Schedule` in the menu for the easiest setup. It accepts day shortcuts like `all`, `weekdays`, `weekend`, or `mon,wed,fri`, and comma-separated 24-hour times like `08:30,13:30,18:30`.

You can also edit the config file manually.

```json
{
  "taskName": "ClaudeCron",
  "macLabel": "com.claudecron",
  "prompt": "hi",
  "model": "haiku",
  "logFile": "claude-run.log",
  "wakeToRun": true,
  "runWhenLocked": true,
  "schedules": [
    {
      "days": ["Wednesday", "Thursday"],
      "times": ["08:30", "13:30", "18:30", "23:30"]
    },
    {
      "days": ["Friday", "Saturday", "Sunday", "Monday", "Tuesday"],
      "times": ["04:30", "09:30", "14:30", "19:30"]
    }
  ]
}
```

Use English day names: `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday`. Use 24-hour `HH:mm` times. Add another schedule block when different days need different times. Keep `"model": "haiku"` because the runner enforces Haiku only.

After changing the config manually, run `claudecron` and choose `Run Background` so Windows Task Scheduler or macOS launchd is updated.
