const selectDirectoryBtn = document.getElementById('select-directory-btn');
const videoList = document.getElementById('video-list');
const videoPlayer = document.getElementById('video-player');
const subtitleTrack = document.getElementById('subtitle-track');
const subtitleToggleBtn = document.getElementById('subtitle-toggle-btn');
const transcriptContainer = document.getElementById('transcript');
const playbackSpeedSlider = document.getElementById('playback-speed');
const speedIndicator = document.getElementById('speed-indicator');
const loopToggleBtn = document.getElementById('loop-toggle-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const subtitleExtensions = ['.vtt', '.srt'];
let currentDirectoryHandle = null;
let loopActive = true;
let loopCue = null;

// --- IndexedDB Functions ---
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('directoryStore', 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            db.createObjectStore('directories', { keyPath: 'id' });
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function saveDirectoryHandle(handle) {
    const db = await openDB();
    const transaction = db.transaction('directories', 'readwrite');
    const store = transaction.objectStore('directories');
    store.put({ id: 'last-selected', handle });
    return transaction.complete;
}

async function getDirectoryHandle() {
    const db = await openDB();
    const transaction = db.transaction('directories', 'readonly');
    const store = transaction.objectStore('directories');
    const request = store.get('last-selected');
    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result ? request.result.handle : null);
        request.onerror = () => resolve(null);
    });
}
// --- End IndexedDB ---

async function listVideoFiles(directoryHandle) {
    currentDirectoryHandle = directoryHandle;
    videoList.innerHTML = '';
    const lastPlayed = localStorage.getItem('lastPlayedFile');
    const videoFiles = [];

    for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'file') {
            const isHidden = entry.name.startsWith('.');
            const isVideo = videoExtensions.some(ext => entry.name.toLowerCase().endsWith(ext));
            if (isVideo && !isHidden) {
                videoFiles.push(entry);
            }
        }
    }

    videoFiles.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of videoFiles) {
        const listItem = document.createElement('li');
        const nameWithoutExt = entry.name.substring(0, entry.name.lastIndexOf('.'));
        listItem.textContent = nameWithoutExt;
        listItem.dataset.fileName = entry.name;
        listItem.style.cursor = 'pointer';
        listItem.addEventListener('click', () => playVideo(entry.name));
        if (entry.name === lastPlayed) {
            listItem.classList.add('playing');
        }
        videoList.appendChild(listItem);
    }
}

async function playVideo(fileName) {
    if (!currentDirectoryHandle) {
        console.error("No directory selected");
        return;
    }
    try {
        const videoFileHandle = await currentDirectoryHandle.getFileHandle(fileName);
        const videoFile = await videoFileHandle.getFile();
        const videoURL = URL.createObjectURL(videoFile);
        videoPlayer.src = videoURL;
        videoPlayer.play();
        localStorage.setItem('lastPlayedFile', fileName);

        // Update playlist highlight
        const currentlyPlaying = videoList.querySelector('.playing');
        if (currentlyPlaying) {
            currentlyPlaying.classList.remove('playing');
        }
        const newPlayingItem = videoList.querySelector(`li[data-file-name="${fileName}"]`);
        if (newPlayingItem) {
            newPlayingItem.classList.add('playing');
        }


        // Reset UI
        subtitleTrack.src = '';
        transcriptContainer.innerHTML = '';
        videoPlayer.textTracks[0].mode = 'hidden';
        subtitleToggleBtn.disabled = true;
        subtitleToggleBtn.classList.remove('active');
        loopCue = null;
        updateLoopButton();


        const videoNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        let subtitleFileHandle = null;

        for (const ext of subtitleExtensions) {
            try {
                subtitleFileHandle = await currentDirectoryHandle.getFileHandle(videoNameWithoutExt + ext);
                if (subtitleFileHandle) break;
            } catch (e) {
                // Not found
            }
        }

        if (subtitleFileHandle) {
            const subtitleFile = await subtitleFileHandle.getFile();
            let vttContent = await subtitleFile.text();

            if (subtitleFile.name.toLowerCase().endsWith('.srt')) {
                vttContent = srtToVtt(vttContent);
            }
            
            const vttBlob = new Blob([vttContent], { type: 'text/vtt' });
            const subtitleURL = URL.createObjectURL(vttBlob);
            
            subtitleTrack.src = subtitleURL;
            subtitleTrack.addEventListener('load', () => {
                populateTranscript(videoPlayer.textTracks[0].cues);
                videoPlayer.textTracks[0].mode = 'hidden';
                subtitleToggleBtn.classList.remove('active');
            }, { once: true });

            subtitleToggleBtn.disabled = false;
        }

    } catch (err) {
        console.error(`Error playing video ${fileName}:`, err);
    }
}

function srtToVtt(srtText) {
    let vtt = "WEBVTT\n\n";
    vtt += srtText
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
        .replace(/^\d+\s*$/gm, '');
    return vtt;
}

function populateTranscript(cues) {
    transcriptContainer.innerHTML = '';
    for (let i = 0; i < cues.length; i++) {
        const cue = cues[i];
        const p = document.createElement('p');
        p.innerHTML = cue.text;
        p.dataset.startTime = cue.startTime;
        p.dataset.endTime = cue.endTime;
        p.dataset.index = i;
        p.addEventListener('click', () => {
            selectLoopCue(cue, p);
        });
        transcriptContainer.appendChild(p);
    }
}

function selectLoopCue(cue, element) {
    if (loopCue) {
        const oldElement = transcriptContainer.querySelector(`p[data-index='${loopCue.index}']`);
        if(oldElement) oldElement.classList.remove('loop-active');
    }
    
    loopCue = cue;
    loopCue.index = element.dataset.index;
    element.classList.add('loop-active');
    videoPlayer.currentTime = cue.startTime;
    videoPlayer.play();
}


const LOOP_END_OFFSET = 0.15; // 150ms

videoPlayer.addEventListener('timeupdate', () => {
    const currentTime = videoPlayer.currentTime;

    if (loopActive && loopCue) {
        const loopEndTime = loopCue.endTime - LOOP_END_OFFSET;
        if (currentTime < loopCue.startTime || currentTime >= loopEndTime) {
            videoPlayer.currentTime = loopCue.startTime;
        }
    }

    const cues = videoPlayer.textTracks[0].cues;
    if (!cues || cues.length === 0) return;

    const activeP = transcriptContainer.querySelector('p.active');
    if (activeP) {
        const startTime = parseFloat(activeP.dataset.startTime);
        const endTime = parseFloat(activeP.dataset.endTime);
        if (currentTime >= startTime && currentTime <= endTime) {
            return;
        }
        activeP.classList.remove('active');
    }

    for (let i = 0; i < cues.length; i++) {
        const cue = cues[i];
        if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
            const newP = transcriptContainer.querySelector(`p[data-index='${i}']`);
            if (newP) {
                newP.classList.add('active');
                newP.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            break;
        }
    }
});

playbackSpeedSlider.addEventListener('input', (event) => {
    const speed = parseFloat(event.target.value);
    videoPlayer.playbackRate = speed;
    speedIndicator.textContent = `${speed.toFixed(1)}x`;
});

subtitleToggleBtn.addEventListener('click', () => {
    const isShowing = videoPlayer.textTracks[0].mode === 'showing';
    videoPlayer.textTracks[0].mode = isShowing ? 'hidden' : 'showing';
    subtitleToggleBtn.classList.toggle('active', !isShowing);
});

loopToggleBtn.addEventListener('click', () => {
    loopActive = !loopActive;
    updateLoopButton();
});

function updateLoopButton() {
    loopToggleBtn.classList.toggle('active', loopActive);
}

selectDirectoryBtn.addEventListener('click', async () => {
    try {
        const directoryHandle = await window.showDirectoryPicker();
        await saveDirectoryHandle(directoryHandle);
        await listVideoFiles(directoryHandle);
    } catch (err) {
        console.error('Error selecting directory:', err);
    }
});

themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeToggleBtn.querySelector('i').textContent = isLight ? 'brightness_7' : 'brightness_4';
});

function loadTheme() {
    const theme = localStorage.getItem('theme');
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        themeToggleBtn.querySelector('i').textContent = 'brightness_7';
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    loadTheme();
    updateLoopButton();
    const directoryHandle = await getDirectoryHandle();
    if (directoryHandle) {
        if (await directoryHandle.queryPermission({ mode: 'read' }) === 'granted') {
            console.log('Auto-loading previously selected directory.');
            await listVideoFiles(directoryHandle);
        } else {
            console.log('Permission for the directory was not granted. Please select it again.');
        }
    }
});