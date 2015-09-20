/**
 * @author troffmo5 / http://github.com/troffmo5
 *
 * Google Street View viewer for the Oculus Rift
 *
 * Modified by jpleitao / http://github.com/jpleitao
 */

// Parameters
// ----------------------------------------------
var QUALITY;
var DEFAULT_LOCATION;
var SHOW_SETTINGS;
var NAV_DELTA;
var FAR;
var USE_DEPTH;

var scene;
var camera;
var controls;
var projSphere;
var progBarContainer;
var progBar;
var renderer;
var effect;
var vrmgr;
var panoLoader;
var panoDepthLoader;

var rotation_angle_cons;
var rotation;


// Globals
// ----------------------------------------------
var WIDTH, HEIGHT;
var currHeading = 0;
var centerHeading = 0;

var headingVector;

// Utility function
// ----------------------------------------------
function angleRangeDeg( angle ) {
    angle %= 360;
    if ( angle < 0 ) {
        angle += 360;
    }
    return angle;
}

function deltaAngleDeg( a, b ) {
    return Math.min( 360 - ( Math.abs( a - b ) % 360 ), Math.abs( a - b ) % 360 );
}


// ----------------------------------------------

function initWebGL() {
    // create scene
    scene = new THREE.Scene();

    // Create camera
    camera = new THREE.PerspectiveCamera( 60, WIDTH/HEIGHT, 0.1, FAR );
    camera.lookAt(new THREE.Vector3( 1, 0, 0 ));
    camera.rotation.order = 'YXZ'; // Rotate first around the Y-Axis, then X, then Z

    // Add VR Controls
    controls  = new THREE.VRControls( camera );

    // Add camera to the scene
    scene.add( camera );

    // Add projection sphere
    projSphere = new THREE.Mesh( new THREE.SphereGeometry( 500, 512, 256, 0, Math.PI * 2, 0, Math.PI ),
                                 new THREE.MeshBasicMaterial( {
                                     map: THREE.ImageUtils.loadTexture( 'images/placeholder.png' ),
                                     side: THREE.DoubleSide
                                 } ) );
    projSphere.geometry.dynamic = true;
    scene.add( projSphere );

    // Add Progress Bar
    progBarContainer = new THREE.Mesh( new THREE.BoxGeometry( 1.2, 0.2, 0.1),
                                       new THREE.MeshBasicMaterial( {color: 0xaaaaaa} ) );
    progBarContainer.translateZ( -3 );
    camera.add( progBarContainer );

    progBar = new THREE.Mesh( new THREE.BoxGeometry( 1.0, 0.1, 0.1 ),
                              new THREE.MeshBasicMaterial( {color: 0x0000ff} ) );
    progBar.translateZ( 0.2 );
    progBarContainer.add( progBar );

    // Create render
    try {
        renderer = new THREE.WebGLRenderer();
    } catch( e ){
        alert( 'This application needs WebGL enabled!' );
        return false;
    }

    renderer.autoClearColor = false;
    renderer.setSize( WIDTH, HEIGHT );

    effect = new THREE.VREffect( renderer );
    effect.setSize( WIDTH, HEIGHT );

    vrmgr = new WebVRManager( effect );

    var viewer = $( '#viewer' );
    viewer.append( renderer.domElement );
    return true;
}

function initControls() {

    // Keyboard
    // ---------------------------------------
    $( document ).keydown( function( event ) {
        switch( event.keyCode ) {
            case 13: // Enter - Move forward
                moveToNextPlace();
                break;
            case 18: // Alt
                USE_DEPTH = !USE_DEPTH;
                setSphereGeometry();
                break;
            case 37: // Left Arrow - Look left
                updateRotation( false, true );
                break;
            case 38: // Up Arrow - Look up
                updateRotation( true, true );
                break;
            case 39: // Right Arrow - Look right
                updateRotation( false, false );
                break;
            case 40: // Down Arrow -- Look down
                updateRotation( true, false );
                break;
        }
    });
}

function initGui() {
    window.addEventListener( 'resize', resize, false );
}

function initPano() {
    panoLoader = new GSVPANO.PanoLoader();
    panoDepthLoader = new GSVPANO.PanoDepthLoader();
    panoLoader.setZoom( QUALITY );

    panoLoader.onProgress = function( progress ) {
        if (progress > 0) {
            progBar.visible = true;
            progBar.scale = new THREE.Vector3( progress / 100.0,  1,1 );
        }

    };
    panoLoader.onPanoramaData = function( result ) {
        progBarContainer.visible = true;
        progBar.visible = false;
    };

    panoLoader.onNoPanoramaData = function( status ) {
        //alert('no data!');
    };

    panoLoader.onPanoramaLoad = function() {
        var a = THREE.Math.degToRad( 90 - panoLoader.heading );
        projSphere.quaternion.setFromEuler( new THREE.Euler( 0, a, 0, 'YZX' ) );

        projSphere.material.wireframe = false;
        projSphere.material.map.needsUpdate = true;
        projSphere.material.map = new THREE.Texture( this.canvas );
        projSphere.material.map.needsUpdate = true;
        centerHeading = panoLoader.heading;

        progBarContainer.visible = false;
        progBar.visible = false;

        panoDepthLoader.load( this.location.pano );
    };

    panoDepthLoader.onDepthLoad = function() {
        setSphereGeometry();
    };
}

function setSphereGeometry() {
    var geom = projSphere.geometry;
    var geomParam = geom.parameters;
    var depthMap = panoDepthLoader.depthMap.depthMap;
    var y, x, u, v, radius, i=0;

    for ( y = 0; y <= geomParam.heightSegments; y ++ ) {
        for ( x = 0; x <= geomParam.widthSegments; x ++ ) {
            u = x / geomParam.widthSegments;
            v = y / geomParam.heightSegments;

            radius = USE_DEPTH ? Math.min(depthMap[y*512 + x], FAR) : 500;

            var vertex = geom.vertices[i];
            vertex.x = - radius * Math.cos( geomParam.phiStart + u * geomParam.phiLength ) *
                         Math.sin( geomParam.thetaStart + v * geomParam.thetaLength );
            vertex.y = radius * Math.cos( geomParam.thetaStart + v * geomParam.thetaLength );
            vertex.z = radius * Math.sin( geomParam.phiStart + u * geomParam.phiLength ) *
                       Math.sin( geomParam.thetaStart + v * geomParam.thetaLength );
            i++;
        }
    }
    geom.verticesNeedUpdate = true;
}

function checkWebVR() {
    if( !vrmgr.isWebVRCompatible() ) {
        $( "#webvrinfo" ).dialog({
            modal: true,
            buttons: {
                Ok: function() {
                  $( this ).dialog( "close" );
                }
            }
        });
    }
    else {
        $( "#webvrinfo" ).hide();
    }
}


function moveToNextPlace() {
    var nextPoint = null;
    var minDelta = 360;
    var navList = panoLoader.links;

    for ( var i = 0; i < navList.length; i++ ) {
        var delta = deltaAngleDeg( currHeading, navList[i].heading );
        if ( delta < minDelta && delta < NAV_DELTA ) {
            minDelta = delta;
            nextPoint = navList[i].pano;
        }
    }

    if ( nextPoint ) {
        console.log("Have next point");
        panoLoader.load( nextPoint );
    } else {
        console.log("Do not have next point");
    }
}

/**
 * Process current rotation input, updating the rotation variable
 * @param updateX   Update the x field of the rotation variable
 * @param increase  Increase the rotation value of the given field
 */
function updateRotation( updateX, increase) {
    if ( updateX ) {
        if ( increase ) {
            rotation.x = ( rotation.x + rotation_angle_cons * Math.PI / 180 ) % (2 * Math.PI);
        } else {
            rotation.x = ( rotation.x - rotation_angle_cons * Math.PI / 180 ) % (2 * Math.PI);
        }
    } else if ( increase ){
        rotation.y = ( rotation.y + rotation_angle_cons * Math.PI / 180 ) % (2 * Math.PI);
    } else {
        rotation.y = ( rotation.y - rotation_angle_cons * Math.PI / 180 ) % (2 * Math.PI);
    }
}

/**
 * Update the rotation of the scene's camera
 */
function updateCameraRotation() {
    camera.rotation.x = rotation.x;
    camera.rotation.y = rotation.y;
    camera.rotation.z = rotation.z;
}

/**
 * Renders the scene, selecting the appropriate renderer taken into account the display mode (normal mode or VR mode)
 */
function render() {
    if ( vrmgr.isVRMode() ) {
        effect.render( scene, camera );
    }
    else {
        updateCameraRotation();
        renderer.render( scene, camera );
    }
}

function resize( event ) {
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;

    renderer.setSize( WIDTH, HEIGHT );
    camera.projectionMatrix.makePerspective( 60, WIDTH /HEIGHT, 1, 1100 );
}

function loop() {
    requestAnimationFrame( loop );

    // Compute heading
    headingVector.setFromQuaternion( camera.quaternion, 'YZX' );
    currHeading = angleRangeDeg( THREE.Math.radToDeg( -headingVector.y ) );

    controls.update();

    // render
    render();
}

function getParams() {
    var params = {};
    var items = window.location.search.substring( 1 ).split( "&" );

    for ( var i=0; i < items.length; i++ ) {
        var kvpair = items[i].split( "=" );
        params[kvpair[0]] = decodeURI( kvpair[1] );
    }
    return params;
}

$(document).ready(function() {
    var params;

    // Initialize some default values
    QUALITY = 3;
    DEFAULT_LOCATION = { lat : 40.201877,  lng : -8.414434 };
    SHOW_SETTINGS = true;
    NAV_DELTA = 45;
    FAR = 1000;
    headingVector = new THREE.Euler();

    // Read parameters
    params = getParams();
    if ( params.lat !== undefined ) {
        DEFAULT_LOCATION.lat = params.lat;
    }
    if ( params.lng !== undefined ) {
        DEFAULT_LOCATION.lng = params.lng;
    }

    if ( params.q !== undefined ) {
        QUALITY = params.q;
    }
    if ( params.s !== undefined ) {
        SHOW_SETTINGS = params.s !== "false";
    }

    if ( params.depth !== undefined ) {
        USE_DEPTH = params.depth !== "false";
    }

    // Get window width and height
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;

    // Initialize user rotation values
    rotation_angle_cons = 10;
    rotation = { x: 0, y : 0, z : 0 };

    if ( !initWebGL() ) {
        return ;
    }
    initControls();
    initGui();
    initPano();

    // Load default location
    panoLoader.load( new google.maps.LatLng( DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng ) );

    checkWebVR();

    loop();
});
