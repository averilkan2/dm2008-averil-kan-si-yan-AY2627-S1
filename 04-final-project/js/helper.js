// This file contains additional helper functions
// DO NOT EDIT unless you need to

document.addEventListener("DOMContentLoaded", init);

// INITIALIZATION
function init() {
  // Only window receives resize events
  window.addEventListener("resize", viewportResized);
  createConnectBtn();
  setupCursorHideBehavior();
  console.info("Helper functions initialized.");
}

// WEB SERIAL HANDLING

// Connection Button
let connectBtn;
let _statusWatcher = null; // { intervalId, timeoutId }

function createConnectBtn() {
  connectBtn = document.createElement("button");
  connectBtn.innerHTML = "Connect Arduino";
  connectBtn.classList.add("connect-btn");
  connectBtn.addEventListener("click", connectBtnClicked); // student's handler
  connectBtn.addEventListener("click", trackPortStatus); // label watcher
  document.body.appendChild(connectBtn);

  setupButtonFadeBehavior(connectBtn);
}

// Button Label Updates
function trackPortStatus() {
  // Need a port to watch
  if (!port) return;

  // Clear any existing watcher so we don't stack intervals
  if (_statusWatcher) {
    clearInterval(_statusWatcher.intervalId);
    clearTimeout(_statusWatcher.timeoutId);
    _statusWatcher = null;
  }

  const startState = port.opened(); // false -> trying to open, true -> trying to close
  const pollEvery = 500; // ms
  const maxWait = 10_000; // ms

  // Interim label while we wait
  connectBtn.innerHTML = startState ? "Disconnecting…" : "Connecting...";

  const intervalId = setInterval(() => {
    const nowOpen = port.opened();
    if (nowOpen !== startState) {
      // state changed — update label and stop
      connectBtn.innerHTML = nowOpen ? "Disconnect Arduino" : "Connect Arduino";
      if (nowOpen) {
        connectBtn.classList.add("disconnect");
      } else {
        connectBtn.classList.remove("disconnect");
      }
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      _statusWatcher = null;
    }
  }, pollEvery);

  const timeoutId = setTimeout(() => {
    // time’s up — stop watching; set label to whatever state we’re actually in
    const nowOpen = port.opened();
    connectBtn.innerHTML = nowOpen ? "Disconnect Arduino" : "Connect Arduino";
    clearInterval(intervalId);
    _statusWatcher = null;
  }, maxWait);

  _statusWatcher = { intervalId, timeoutId };
}

// Fade Behavior
function setupButtonFadeBehavior(btn) {
  let fadeTimeout;
  const fadeDelay = 5000; // ms before fading out

  const showBtn = () => (btn.style.opacity = 1);
  const hideBtn = () => (btn.style.opacity = 0);

  // Reset timer whenever there's mouse movement
  function resetFadeTimer() {
    clearTimeout(fadeTimeout);
    showBtn();
    fadeTimeout = setTimeout(hideBtn, fadeDelay);
  }

  // Listen globally for mouse movement
  window.addEventListener("mousemove", resetFadeTimer);
  // Initial fade after a delay
  resetFadeTimer();
}

// HIDE CURSOR
function setupCursorHideBehavior() {
  let hideTimeout;
  const hideDelay = 5_000; // ms of inactivity before hiding

  function showCursor() {
    document.body.classList.remove("cursor-hidden");
  }

  function hideCursor() {
    document.body.classList.add("cursor-hidden");
  }

  function resetCursorTimer() {
    clearTimeout(hideTimeout);
    showCursor();
    hideTimeout = setTimeout(hideCursor, hideDelay);
  }

  // Reset timer on any mouse movement or click
  window.addEventListener("mousemove", resetCursorTimer);
  window.addEventListener("mousedown", resetCursorTimer);
  window.addEventListener("keydown", resetCursorTimer);

  // Kick things off
  resetCursorTimer();
}

// RESIZE HANDLING
let _isFullscreenCanvas;

function viewportResized() {
  // Ensure p5 globals are available before doing anything
  if (
    typeof window.resizeCanvas !== "function" ||
    typeof window.windowWidth === "undefined" ||
    typeof window.width === "undefined"
  ) {
    return;
  }

  // Decide if current canvas seems like it was made full-window?
  if (_isFullscreenCanvas === undefined) {
    _isFullscreenCanvas = width === windowWidth && height === windowHeight;
  }
  if (_isFullscreenCanvas) {
    // p5 updates windowWidth/windowHeight in its own resize listener, which runs
    // after this one — wait a frame so we resize to the new size, not the old one
    requestAnimationFrame(() => resizeCanvas(windowWidth, windowHeight));
  }
}
