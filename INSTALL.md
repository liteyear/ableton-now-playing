ABLETON NOW PLAYING — START HERE

1. Extract the downloaded release ZIP completely.
2. Drag Ableton Now Playing.app into Applications.
3. Open it. Follow the four steps in the browser setup page.

FIRST OPEN ON MAC
The app is unsigned. If macOS blocks it, open System Settings > Privacy & Security and choose Open Anyway after trying to open the app. On older macOS, right-click the app and choose Open. If it reports damage or still refuses, report the exact message in a GitHub issue. No Terminal steps are required.

STEP 1 — INSTALL THE CONNECTION
Save your work and quit Ableton Live. Click Install AbletonOSC in the wizard. If your Ableton User Library is somewhere other than Music/Ableton/User Library, use Choose User Library. Its location appears in Live Settings > Library. Existing AbletonOSC folders are left unchanged.

STEP 2 — ENABLE ABLETONOSC
Open Ableton and your DJ Set. In Settings / Preferences > Link, Tempo & MIDI (wording varies), select AbletonOSC in an unused Control Surface row. Input: None. Output: None. Wait for Ableton connected in the wizard. If AbletonOSC is missing, fully quit and reopen Live.

STEP 3 — CHOOSE YOUR DECKS
Select only the tracks containing the songs you want shown. Choose the latest launched song or all playing selected songs. Select your clip-name format and optional subtitle. Click Save settings. Rename clips in Ableton to the text you want on stream.

STEP 4 — ADD THE WIDGET TO OBS
Add a Browser source. Leave Local file unchecked. Paste:
http://127.0.0.1:3210/overlay.html
Width: 1100. Height: 180. Use custom frame rate: 1 FPS.
Enable Shutdown source when not visible. Leave Custom CSS at its default.
Click OK. Keep this source above your camera/video sources, with its eye icon on.
Click Show test card in OBS for 20 seconds in the wizard. If needed, right-click the OBS source > Transform > Fit to Screen, then resize and position it.
No extra Text or Color sources are needed.

EVERY STREAM
Open the app, Ableton, and OBS. Check the title, then close the setup browser tab. The app keeps running. After streaming, reopen the app and click Stop widget. It does not start at login.

UPDATING
Click Stop widget in the old setup page before replacing the app. If that page will not open, restart the Mac. Then replace the app in Applications with the new copy. Saved settings remain.

NOT VISIBLE?
Use the test-card button first. If the test card appears, the OBS source works; check your Ableton connection, selected decks, clip playback, and mute state. The card normally hides when stopped. If the test card does not appear, confirm the app is running, the URL is correct, the source is visible and above other sources, and the source is inside the canvas.

PORT BUSY / OLD PROCESS
Open http://127.0.0.1:3210/ and click Stop widget. If unavailable, restart the Mac. The background runtime appears as node in Activity Monitor; other apps can use that name too. Do not quit unrelated processes. Personalized or older widget versions share the same OSC ports and must be stopped first.

REMOVE
Stop the widget and delete the app. Settings remain in ~/Library/Application Support/Ableton Now Playing. The log is ~/Library/Logs/Ableton-Now-Playing.log. AbletonOSC remains in your User Library/Remote Scripts/AbletonOSC. Do not remove it if other tools use it.

Official AbletonOSC project: https://github.com/ideoforms/AbletonOSC
