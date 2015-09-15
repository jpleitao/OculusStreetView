/*
 * Copyright 2015 Boris Smus. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Modified by jpleitao / http://github.com/jpleitao
 */

/**
 * Helper for getting in and out of VR mode.
 * Here we assume VR mode == full screen mode.
 *
 * 1. Detects whether or not VR mode is possible by feature detecting for
 * WebVR (or polyfill).
 *
 * 2. If WebVR is available, provides means of entering VR mode:
 * - Double click
 * - Double tap
 * - Click "Enter VR" button
 *
 * 3. Provides best practices while in VR mode.
 * - Full screen
 * - Wake lock
 * - Orientation lock (mobile only)
 */
(function() {

function WebVRManager( effect, opts ) {
    this.opts = opts || {};

    // Set option to hide the button.
    this.hideButton = this.opts.hideButton || false;

    // Save the THREE.js effect for later.
    this.effect = effect;

    // Get the vrButton (could be done with jquery but then a lot of code would have to be changed, so let's avoid that
    // for now)
    this.vrButton = document.getElementById( "vrButton" );
    // Add preventDefault Event Listener to the button
    this.vrButton.addEventListener( 'dragstart', function( e ) {
        // Ignore drag
        e.preventDefault();
    });

    // Check if the browser is compatible with WebVR.
    this.isHMDAvailable().then( function(isCompatible) {
        if ( isCompatible ) {
            this.setMode( Modes.COMPATIBLE );
            // If it is, activate VR mode.
            this.activateVR();
        } else {
          this.setMode( Modes.INCOMPATIBLE );
          // Incompatible? At least prepare for "immersive" mode.
          this.activateBig();
        }
    }.bind( this ) );

    this.os = this.getOS();
}

var Modes = {
    // Incompatible with WebVR.
    INCOMPATIBLE: 1,
    // Compatible with WebVR.
    COMPATIBLE: 2,
    // In virtual reality via WebVR.
    IMMERSED: 3
};

/**
 * True if this browser supports WebVR.
 */
WebVRManager.prototype.isWebVRCompatible = function() {
    return 'getVRDevices' in navigator || 'mozGetVRDevices' in navigator || 'webkitGetVRDevices' in navigator;
};

/**
 * Promise returns true if there is at least one HMD device available.
 */
WebVRManager.prototype.isHMDAvailable = function() {
    return new Promise( function(resolve, reject ) {
        navigator.getVRDevices().then( function( devices ) {
            // Promise succeeds, but check if there are any devices actually.
            for ( var i = 0; i < devices.length; i++ ) {
                if ( devices[i] instanceof HMDVRDevice ) {
                    resolve( true );
                    break;
                }
            }
            resolve( false );
        }, function() {
            // No devices are found.
            resolve( false );
        });
    });
};

WebVRManager.prototype.isVRMode = function() {
    return this.mode == Modes.IMMERSED;
};

WebVRManager.prototype.setMode = function( mode ) {
    this.mode = mode;
    console.log( "In mode " + mode );
    switch ( mode ) {
        case Modes.INCOMPATIBLE:
            this.vrButton.src = 'images/vrButton/incompatible_mode.svg';
            this.vrButton.title = 'Open in immersive mode';
            this.setContrast( 0.5 );
            break;
        case Modes.COMPATIBLE:
            this.vrButton.src = 'images/vrButton/compatible_mode.svg';
            this.vrButton.title = 'Open in VR mode';
            this.setContrast( 0.25 );
            break;
        case Modes.IMMERSED:
            this.vrButton.src = 'images/vrButton/immersed_mode.svg';
            this.vrButton.title = 'Leave VR mode';
            this.setContrast( 0.25 );
            break;
    }

    // Hack for Safari Mac/iOS to force relayout (svg-specific issue)
    // http://goo.gl/hjgR6r
    this.vrButton.style.display = 'inline-block';
    //this.vrButton.offsetHeight; //This line does not make anything!
    this.vrButton.style.display = 'block';
};

/**
 * Sets the contrast on the button (percent in [0, 1]).
 */
WebVRManager.prototype.setContrast = function( percent ) {
    var value = Math.floor( percent * 100 );
    this.vrButton.style.webkitFilter = 'contrast(' + value + '%)';
    this.vrButton.style.filter = 'contrast(' + value + '%)';
};

WebVRManager.prototype.base64 = function( format, base64 ) {
    return 'data:' + format + ';base64,' + base64;
};

/**
 * Makes it possible to go into VR mode.
 */
WebVRManager.prototype.activateVR = function() {
    // Make it possible to enter VR via double click.
    window.addEventListener( 'dblclick', this.enterVR.bind( this ) );
    // Or via double tap.
    window.addEventListener( 'touchend', this.onTouchEnd.bind( this ) );
    // Or via clicking on the VR button.
    this.vrButton.addEventListener( 'mousedown', this.onButtonClick.bind( this ) );
    this.vrButton.addEventListener( 'touchstart', this.onButtonClick.bind( this ) );
    // Or by hitting the 'f' key.
    window.addEventListener('keydown', this.onKeyDown.bind(this));

    // Whenever we enter fullscreen, this is tantamount to entering VR mode.
    document.addEventListener( 'webkitfullscreenchange', this.onFullscreenChange.bind( this ) );
    document.addEventListener( 'mozfullscreenchange', this.onFullscreenChange.bind( this ) );

    // Create the necessary elements for wake lock to work.
    this.setupWakeLock();
};

WebVRManager.prototype.activateBig = function() {
    // Next time a user does anything with their mouse, we trigger big mode.
    this.vrButton.addEventListener( 'click', this.enterBig.bind( this ) );
};

WebVRManager.prototype.enterBig = function() {
    this.requestPointerLock();
    this.requestFullscreen();
};

WebVRManager.prototype.setupWakeLock = function() {
    // Create a small video element.
    this.wakeLockVideo = document.createElement( 'video' );

    // Loop the video.
    this.wakeLockVideo.addEventListener( 'ended', function( ev ) {
        this.wakeLockVideo.play();
    }.bind( this ) );

    // Turn on wake lock as soon as the screen is tapped.
    this.triggerWakeLock = function() {
        this.requestWakeLock();
    }.bind( this );
    window.addEventListener( 'touchstart', this.triggerWakeLock, false );
};

WebVRManager.prototype.onTouchEnd = function(e) {
    // TODO: Implement better double tap that takes distance into account.
    // https://github.com/mckamey/doubleTap.js/blob/master/doubleTap.js

    var now = new Date();
    if ( now - this.lastTouchTime < 300 ) {
        this.enterVR();
    }
    this.lastTouchTime = now;
};

WebVRManager.prototype.onButtonClick = function( e ) {
    e.stopPropagation();
    e.preventDefault();
    this.toggleVRMode();
};

WebVRManager.prototype.onKeyDown = function( e ) {
    if ( e.keyCode == 70 ) { // 'f'
        this.toggleVRMode();
    }
};

WebVRManager.prototype.toggleVRMode = function() {
    if ( !this.isVRMode() ) {
        // Enter VR mode.
        this.enterVR();
    } else {
        this.exitVR();
    }
};

WebVRManager.prototype.onFullscreenChange = function( e ) {
    // If we leave full-screen, also exit VR mode.
    if ( document.webkitFullscreenElement === null || document.mozFullScreenElement === null ) {
        this.exitVR();
    }
};

/**
 * Add cross-browser functionality to keep a mobile device from
 * auto-locking.
 */
WebVRManager.prototype.requestWakeLock = function() {
    this.releaseWakeLock();
    if ( this.os == 'iOS' ) {
        // If the wake lock timer is already running, stop.
        if ( this.wakeLockTimer ) {
            return;
        }
        this.wakeLockTimer = setInterval( function() {
            window.location = window.location;
            setTimeout( window.stop, 0 );
        }, 30000 );
    } else if ( this.os == 'Android' ) {
        // If the video is already playing, do nothing.
        if ( this.wakeLockVideo.paused === false ) {
            return;
        }
        // See videos_src/no-sleep.webm.
        this.wakeLockVideo.src = this.base64('video/webm', 'GkXfowEAAAAAAAAfQoaBAUL3gQFC8oEEQvOBCEKChHdlYm1Ch4ECQoWBAhhTgGcBAAAAAAACWxFNm3RALE27i1OrhBVJqWZTrIHfTbuMU6uEFlSua1OsggEuTbuMU6uEHFO7a1OsggI+7AEAAAAAAACkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmAQAAAAAAAEMq17GDD0JATYCMTGF2ZjU2LjQuMTAxV0GMTGF2ZjU2LjQuMTAxc6SQ20Yv/Elws73A/+KfEjM11ESJiEBkwAAAAAAAFlSuawEAAAAAAABHrgEAAAAAAAA+14EBc8WBAZyBACK1nIN1bmSGhVZfVlA4g4EBI+ODhAT3kNXgAQAAAAAAABKwgRC6gRBTwIEBVLCBEFS6gRAfQ7Z1AQAAAAAAALHngQCgAQAAAAAAAFyho4EAAIAQAgCdASoQABAAAEcIhYWIhYSIAgIADA1gAP7/q1CAdaEBAAAAAAAALaYBAAAAAAAAJO6BAaWfEAIAnQEqEAAQAABHCIWFiIWEiAICAAwNYAD+/7r/QKABAAAAAAAAQKGVgQBTALEBAAEQEAAYABhYL/QACAAAdaEBAAAAAAAAH6YBAAAAAAAAFu6BAaWRsQEAARAQABgAGFgv9AAIAAAcU7trAQAAAAAAABG7j7OBALeK94EB8YIBgfCBAw==');
        this.wakeLockVideo.play();
    }
};

/**
 * Turn off cross-browser functionality to keep a mobile device from
 * auto-locking.
 */
WebVRManager.prototype.releaseWakeLock = function() {
    if ( this.os == 'iOS' ) {
        if ( this.wakeLockTimer ) {
            clearInterval( this.wakeLockTimer );
            this.wakeLockTimer = null;
        }
    } else if ( this.os == 'Android' ) {
        this.wakeLockVideo.pause();
        this.wakeLockVideo.src = '';
    }
};

WebVRManager.prototype.requestPointerLock = function() {
    var canvas = this.effect._renderer.domElement;
    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock ||
                                canvas.webkitRequestPointerLock;

    canvas.requestPointerLock();
};

WebVRManager.prototype.releasePointerLock = function() {
    document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock || document.webkitExitPointerLock;

    document.exitPointerLock();
};

WebVRManager.prototype.requestOrientationLock = function() {
    if ( screen.orientation ) {
        screen.orientation.lock( 'landscape' );
    }
};

WebVRManager.prototype.releaseOrientationLock = function() {
    if ( screen.orientation ) {
        screen.orientation.unlock();
    }
};

WebVRManager.prototype.requestFullscreen = function() {
    var canvas = this.effect._renderer.domElement;

    if ( canvas.mozRequestFullScreen ) {
        canvas.mozRequestFullScreen();
    } else if ( canvas.webkitRequestFullscreen ) {
        canvas.webkitRequestFullscreen();
    }
};

WebVRManager.prototype.releaseFullscreen = function() {};

WebVRManager.prototype.getOS = function( osName ) {
    var userAgent = navigator.userAgent || navigator.vendor || window.opera;

    if (userAgent.match( /iPhone/i ) || userAgent.match( /iPod/i ) ) {
        return 'iOS';
    } else if ( userAgent.match( /Android/i ) ) {
        return 'Android';
    }
    return 'unknown';
};

WebVRManager.prototype.enterVR = function() {
    console.log( 'Entering VR.' );
    // Enter fullscreen mode (note: this doesn't work in iOS).
    this.effect.setFullScreen( true );
    // Lock down orientation, pointer, etc.
    this.requestOrientationLock();
    // Set style on button.
    this.setMode( Modes.IMMERSED );
};

WebVRManager.prototype.exitVR = function() {
    console.log( 'Exiting VR.' );
    // Leave fullscreen mode (note: this doesn't work in iOS).
    this.effect.setFullScreen( false );
    // Release orientation, wake, pointer lock.
    this.releaseOrientationLock();
    this.releaseWakeLock();
    // Go back to compatible mode.
    this.setMode( Modes.COMPATIBLE );
};

// Expose the WebVRManager class globally.
window.WebVRManager = WebVRManager;

})();
