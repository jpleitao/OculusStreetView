OculusStreetView
================

Google Street View viewer for the Oculus Rift, based on troffmo5's project.

Original project can be found in https://github.com/troffmo5/OculusStreetView

Usage
-------------
- Open the web page (a series of parameters can be specified in the URL -- See next section) 
- Double click the image to start the VR mode, or click in the small icon on the bottom of the web page
- Use the controls listed above to move around in the world (not yet implemented)

URL Parameters
-------------
index.html accepts the following parameters

- *lat*, *lng* : latitude and longitude (e.g lat=-23.442896&lng=151.906584)
- *q* : image quality (1: worst, 4:best)
- *s* : show mini-map and settings (true or false)
- *depth* : Use depth information (*true* or *false*)

Example:  
file://index.html?lat=-23.442896&lng=151.906584&q=4&s=false

Controls
-------------
- *Left Arrow* : Look left
- *Right Arrow* : Look right
- *Up Arrow* : Look up
- *Down Arrow* : Look down
- *Alt* : Toogle depth
- *Enter* : Move forward

Supported Browsers
-------------

As of now all the testing is being made with the **Oculus Rift DK1**, a **Chromium WebVR** build and the **vr.js** plugin.

The **Chromium WebVR** build that is currently being tested is available at
https://drive.google.com/folderview?id=0BzudLt22BqGRa29TN1loVDBSSE0&tid=0BzudLt22BqGRbW9WTHMtOWMzNjQ , while the **vr.js**
plugin can be found in the following link: https://github.com/benvanik/vr.js

**Mozilla's Nightly** versions of Firefox (containing WebVR support) have not been tested yet, but they should also work,
provided the required plugin is correctly installed.

Licence
-------------
MIT Licence
