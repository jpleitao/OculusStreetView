/**
 * @author troffmo5 / http://github.com/troffmo5
 *
 * Google Street View viewer for the Oculus Rift
 *
 * Modified by jpleitao / http://github.com/jpleitao
 */

// Parameters
// ----------------------------------------------
var QUALITY = 3;
var DEFAULT_LOCATION = { lat:44.301945982379095,  lng:9.211585521697998 };
var USE_TRACKER = false;
var SHOW_SETTINGS = true;
var NAV_DELTA = 45;
var FAR = 1000;
var USE_DEPTH = false;
var WORLD_FACTOR = 1.0;

var WEBSOCKET_ADDR;
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


// Globals
// ----------------------------------------------
var WIDTH, HEIGHT;
var currHeading = 0;
var centerHeading = 0;

var headingVector = new THREE.Euler();

// Utility function
// ----------------------------------------------
function angleRangeDeg( angle ) {
    angle %= 360;
    if ( angle < 0 ) {
        angle += 360;
    }
    return angle;
}

function angleRangeRad( angle ) {
    angle %= 2*Math.PI;
    if ( angle < 0 ) {
        angle += 2*Math.PI;
    }
    return angle;
}

function deltaAngleDeg( a, b ) {
    return Math.min( 360 - ( Math.abs( a - b ) % 360 ), Math.abs( a - b ) % 360 );
}

function deltaAngleRas( a, b ) {
  // todo
}


// ----------------------------------------------

function initWebGL() {
    // create scene
    scene = new THREE.Scene();

    // Create camera
    camera = new THREE.PerspectiveCamera( 60, WIDTH/HEIGHT, 0.1, FAR );
    camera.target = new THREE.Vector3( 1, 0, 0 );
    controls  = new THREE.VRControls( camera );

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
}

function initControls() {

    // Keyboard
    // ---------------------------------------
    var lastSpaceKeyTime = new Date(), lastCtrlKeyTime = lastSpaceKeyTime;

    $( document ).keydown( function( e ) {
        //console.log(e.keyCode);
        switch( e.keyCode ) {
            case 87: //W
                console.log("Going to load new location");
                panoLoader.load( new google.maps.LatLng( 40.201877, -8.414434 ) );
                break;
            case 18: // Alt
                USE_DEPTH = !USE_DEPTH;
                setSphereGeometry();
                break;
        }
    });

    // Mouse
    // ---------------------------------------
    var viewer = $( '#viewer' );

    viewer.dblclick( function() {
        console.log( "double-click in the viewer!" );
        moveToNextPlace();
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
        var a = THREE.Math.degToRad( 90-panoLoader.heading );
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

    if (nextPoint) {
        panoLoader.load(nextPoint);
    }
}

function render() {
    if ( vrmgr.isVRMode() ) {
        effect.render( scene, camera );
    }
    else {
        renderer.render( scene, camera );
    }
}

function setUiSize() {
    var width = window.innerWidth, hwidth = width/2, height = window.innerHeight;
    var ui = $( '#ui-main' );
    var hsize=0.60, vsize = 0.40;

    ui.css( 'width', hwidth * hsize );
    ui.css( 'left', hwidth - hwidth * hsize / 2 ) ;
    ui.css( 'height', height * vsize );
    ui.css( 'margin-top', height * ( 1 - vsize ) / 2 );
}

function resize( event ) {
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;
    setUiSize();

    renderer.setSize( WIDTH, HEIGHT );
    camera.projectionMatrix.makePerspective( 60, WIDTH /HEIGHT, 1, 1100 );
}

function loop() {
    requestAnimationFrame( loop );

    // Apply movement
    // FIXME: SEE THIS
    // BaseRotationEuler.set( angleRangeRad( BaseRotationEuler.x + gamepadMoveVector.x ),
    //                        angleRangeRad( BaseRotationEuler.y + gamepadMoveVector.y ), 0.0 );
    // BaseRotation.setFromEuler( BaseRotationEuler, 'YZX' );

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

    // Read parameters
    params = getParams();
    if ( params.lat !== undefined ) {
        DEFAULT_LOCATION.lat = params.lat;
    }
    if ( params.lng !== undefined ) {
        DEFAULT_LOCATION.lng = params.lng;
    }

    console.log( "This should be undefined: " + params.sock );

    if ( params.sock !== undefined ) {
        WEBSOCKET_ADDR = 'ws://'+params.sock;
        USE_TRACKER = true;
    }
    if ( params.q !== undefined ) {
        QUALITY = params.q;
    }
    if ( params.s !== undefined ) {
        SHOW_SETTINGS = params.s !== "false";
    }

    // FIXME: ALSO CHECK THIS
    // if ( params.heading !== undefined ) {
    //   BaseRotationEuler.set( 0.0, angleRangeRad( THREE.Math.degToRad( -parseFloat(params.heading ) ) ) , 0.0 );
    //   BaseRotation.setFromEuler( BaseRotationEuler, 'YZX' );
    // }

    if ( params.depth !== undefined ) {
        USE_DEPTH = params.depth !== "false";
    }
    if ( params.wf !== undefined ) {
        WORLD_FACTOR = parseFloat( params.wf );
    }

    // Get window width and height
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;

    setUiSize();
    initWebGL();
    initControls();
    initGui();
    initPano();

    // Load default location
    panoLoader.load( new google.maps.LatLng( DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng ) );

    checkWebVR();

    loop();
});
