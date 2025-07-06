# Shadow Reading Player

This is a simple, elegant video player designed for language learning through shadow reading. It allows you to load a directory of videos and their corresponding subtitles, with features focused on making practice and repetition easy.

## Features

- **Directory-Based Video Library:** Select a directory on your computer, and the application will automatically populate a list of all video files.
- **Subtitle Support:** Automatically loads and displays subtitles (in `.vtt` or `.srt` format) that match the video's filename.
- **HTML in Subtitles:** Both the transcript panel and the on-screen subtitles support HTML for rich text formatting.
- **Transcript Panel:** See the full transcript of the video, which highlights the currently spoken line.
- **Looping:** Toggle a loop function to repeat the current subtitle line, allowing for focused practice.
- **Click-to-Sync:** Click on any line in the transcript to jump to that point in the video.
- **Theme Switching:** Easily switch between a light and dark theme. Your preference is saved in your browser.
- **Clean UI:** A modern, minimal interface that hides file extensions and scrollbars for a clean look.

## How to Use

1.  **Open `index.html`:** Open the `index.html` file in a modern web browser (like Chrome, Firefox, or Edge) that supports the File System Access API.
2.  **Select a Directory:** Click the "folder" icon in the top-left corner to select a directory containing your video and subtitle files.
3.  **Choose a Video:** Click on any video from the list to begin playing.

**Note:** For subtitles to work, they must have the same name as the video file (e.g., `my-video.mp4` and `my-video.vtt`).

## Technologies Used

- HTML5
- CSS3
- JavaScript (ES6+)
- Material Icons
