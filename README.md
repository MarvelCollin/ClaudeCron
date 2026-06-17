# ClaudeCron

Command-line scheduler for running Claude CLI prompts in the background.

## Setup

```bash
npm install
npm run login
```

Run `npm run login` once so Claude CLI is authenticated.

## Manage Schedule

```cmd
npm run task
```

Choose `1` to install or update the background schedule. Choose `6` to check whether it is installed, enabled, currently running, the next run time, and how many runs succeeded or failed.

## Config Tutorial

Edit `claudecron.config.json`.

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

After changing the config, run `npm run task` and choose `1` again so Windows Task Scheduler or macOS launchd is updated.
