A'lochi student panel — sound assets
=====================================

The lib/sound.ts client uses these files. If any are missing the UI still
works — playSound() catches the play() rejection silently.

Required files (CC0 / royalty-free recommended):

  correct.mp3   ~250 ms   bell ding              played on correct answer
  wrong.mp3     ~300 ms   soft buzz / thud       played on wrong answer
  complete.mp3  ~1.2 s    short fanfare          end of lesson celebration
  xp.mp3        ~150 ms   coin pickup            +XP toast
  levelup.mp3   ~1.5 s    ascending arpeggio     league / level promotion

Format: mp3, mono is fine, target -14 LUFS so volume defaults (0.6) feel
right next to in-app speech.

Sources for free / CC0 assets:
  https://freesound.org              (filter: License = Creative Commons 0)
  https://mixkit.co/free-sound-effects/
  https://pixabay.com/sound-effects/

Quick placeholder workflow:
  1. Open Audacity → Generate → Tone (sine 880 Hz, 250 ms) for correct.
  2. Generate → Tone (sawtooth 220 Hz, 300 ms) for wrong.
  3. Export as MP3 named per the table above into this directory.

Production audio assets should be commissioned with the brand team and
mastered together so volumes line up.
