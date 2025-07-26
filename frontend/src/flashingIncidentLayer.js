import {
  mat3,
  vec2,
  vec3
} from 'https://cdn.jsdelivr.net/npm/gl-matrix@2.8.1/+esm';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import BaseLayerViewGL2D from '@arcgis/core/views/2d/layers/BaseLayerViewGL2D.js';
import esriConfig from '@arcgis/core/config.js';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils.js';

esriConfig.apiKey =
  'AAPTxy8BH1VEsoebNVZXo8HurExiheV8fp-Y5bdvR4oy2dC-XI7t-pbEluS39zbJeg0GaiY7Vp5WjXY_ze7MroCgHxBCRuJUHYcNagIHynfKvB5cMm-rvGo_V_yJ4WlBKew2aNjHsyU88PXm_FXwJh3_w_0MpxGfgoFapEas5kzZd5I23PwVuJLoo811sevETSYTS1NnT5zxgCdFTJwgeBwyOFJ86mFJk9OBPS3TVbJ5oBctSqPdMnm5zNLTHpkQcfSEAT1_d9LFzwbr';
// Subclass the custom layer view from BaseLayerViewGL2D.
const CustomLayerView2D = BaseLayerViewGL2D.createSubclass({
  // Locations of the two vertex attributes that we use. They
  // will be bound to the shader program before linking.
  aPosition: 0,
  aOffset: 1,

  constructor: function () {
    // Geometrical transformations that must be recomputed
    // from scratch at every frame.
    this.transform = mat3.create();
    this.translationToCenter = vec2.create();
    this.screenTranslation = vec2.create();

    // Geometrical transformations whose only a few elements
    // must be updated per frame. Those elements are marked
    // with NaN.
    this.display = mat3.fromValues(NaN, 0, 0, 0, NaN, 0, -1, 1, 1);
    this.screenScaling = vec3.fromValues(NaN, NaN, 1);

    // Whether the vertex and index buffers need to be updated
    // due to a change in the layer data.
    this.needsUpdate = false;
  },

  // Called once a custom layer is added to the map.layers collection and this layer view is instantiated.
  attach: function () {
    const gl = this.context;

    // We listen for changes to the graphics collection of the layer
    // and trigger the generation of new frames. A frame rendered while
    // `needsUpdate` is true may cause an update of the vertex and
    // index buffers.
    const requestUpdate = () => {
      this.needsUpdate = true;
      this.requestRender();
    };
    this.watcher = reactiveUtils.on(
      () => this.layer.graphics,
      'change',
      requestUpdate
    );

    // Define and compile shaders.
    const vertexSource = `
              precision highp float;
              uniform mat3 u_transform;
              uniform mat3 u_display;
              attribute vec2 a_position;
              attribute vec2 a_offset;
              varying vec2 v_offset;
              const float SIZE = 70.0;
              uniform float u_size_px;
              void main(void) {
                  gl_Position.xy = (u_display * (u_transform * vec3(a_position, 1.0) + vec3(a_offset * u_size_px, 0.0))).xy;
                  gl_Position.zw = vec2(0.0, 1.0);
                  v_offset = a_offset;
              }`;

    const fragmentSource = `
              precision highp float;

uniform float u_current_time;          // seconds since load
varying vec2  v_offset;                // (‑0.5 … +0.5)
uniform vec3 u_core_color;
uniform vec3 u_glow_color;
uniform float u_pulse_freq;
uniform float u_core_radius;
uniform float u_glow_radius;
uniform float u_spark_ampl;
uniform float u_spark_freq;
uniform float u_size_px;

// ── STYLE PARAMETERS ─────────────────────────────────────────────
const float SIZE_PX      = 70.0;           // ↔ must match vertex SIZE
const float CORE_RADIUS  =  4.0;           // px  (was 6)
const float GLOW_RADIUS  = 16.0;           // px  (slightly tighter)

const vec3  CORE_COLOR   = vec3(1.00, 0.25, 0.25);   // hot red
const vec3  GLOW_COLOR   = vec3(0.85, 0.10, 0.10);   // deep crimson
const float PULSE_FREQ   = 2.0;            // Hz  – gentle breathing
const float PULSE_AMPL   = 0.20;           // 0–1 brightness swing
const float SPARK_AMPL   = 0.10;           // residual “static” (now subtle)
// ────────────────────────────────────────────────────────────────

// Minimal hash – returns 0‑1 noise *per quad*, not per pixel
float hashp(vec2 p){
  return fract(sin(dot(p ,vec2(127.1,311.7))) * 43758.5453);
}

void main(void)
{
    // 1) radius in pixels
    float r = length(v_offset) * u_size_px;

    // 2) base disc (hard centre, anti‑aliased edge)
    float core = 1.0 - smoothstep(u_core_radius - 1.0,
                                  u_core_radius + 1.0,
                                  r);

    // 3) soft halo
    float glow = exp( -pow( max(r - u_core_radius, 0.0) /
                            (u_glow_radius - u_core_radius), 2.0) );

    // 4) smooth global pulse (every fragment in this point brightens together)
    float pulse = 1.0 + PULSE_AMPL *
                  sin(u_current_time * 6.28318 * u_pulse_freq);

    // 5) light, desynchronised sparkle (one value per point, not per pixel)
    //    – converts INT vec2 to one number by flooring the quad’s screen coords
    float rnd  = hashp(floor(gl_FragCoord.xy / 128.0));
    // float spark = 1.0 + u_spark_ampl * sin(u_current_time * 60.0 + rnd * 6.28318);
    float spark = 1.0 + u_spark_ampl * sin(u_current_time * 6.28318 * u_spark_freq + rnd * 6.28318);
    // 6) compose brightness
    float a = clamp(core + glow, 0.0, 1.0) * pulse * spark;

    // 7) final additive colour
    vec3  rgb = core * u_core_color + glow * u_glow_color;
    gl_FragColor = vec4(rgb * a, a);
}


`;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);

    // Create the shader program.
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);

    // Bind attributes.
    gl.bindAttribLocation(this.program, this.aPosition, 'a_position');
    gl.bindAttribLocation(this.program, this.aOffset, 'a_offset');

    // Link.
    gl.linkProgram(this.program);

    // Shader objects are not needed anymore.
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    // Retrieve uniform locations once and for all.
    this.uTransform = gl.getUniformLocation(this.program, 'u_transform');
    this.uDisplay = gl.getUniformLocation(this.program, 'u_display');
    this.uCurrentTime = gl.getUniformLocation(this.program, 'u_current_time');
    this.uCoreColor = gl.getUniformLocation(this.program, 'u_core_color');
    this.uGlowColor = gl.getUniformLocation(this.program, 'u_glow_color');
    this.uPulseFreq   = gl.getUniformLocation(this.program, 'u_pulse_freq');
    this.uCoreRadius  = gl.getUniformLocation(this.program, 'u_core_radius');
    this.uGlowRadius  = gl.getUniformLocation(this.program, 'u_glow_radius');
    this.uSparkAmpl   = gl.getUniformLocation(this.program, 'u_spark_ampl');
    this.uSparkFreq   = gl.getUniformLocation(this.program, 'u_spark_freq');
    this.uSizePx = gl.getUniformLocation(this.program, 'u_size_px');



    // Create the vertex and index buffer. They are initially empty. We need to track the
    // size of the index buffer because we use indexed drawing.
    this.vertexBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();

    // Number of indices in the index buffer.
    this.indexBufferSize = 0;

    // When certain conditions occur, we update the buffers and re-compute and re-encode
    // all the attributes. When buffer update occurs, we also take note of the current center
    // of the view state, and we reset a vector called `translationToCenter` to [0, 0], meaning that the
    // current center is the same as it was when the attributes were recomputed.
    this.centerAtLastUpdate = vec2.fromValues(
      this.view.state.center[0],
      this.view.state.center[1]
    );
  },

  // Called once a custom layer is removed from the map.layers collection and this layer view is destroyed.
  detach: function () {
    // Stop watching the `layer.graphics` collection.
    this.watcher.remove();

    const gl = this.context;

    // Delete buffers and programs.
    gl.deleteBuffer(this.vertexBuffer);
    gl.deleteBuffer(this.indexBuffer);
    gl.deleteProgram(this.program);
  },

  // Called every time a frame is rendered.
  render: function (renderParameters) {
    const gl = renderParameters.context;
    const state = renderParameters.state;

    // Update vertex positions. This may trigger an update of
    // the vertex coordinates contained in the vertex buffer.
    // There are three kinds of updates:
    //  - Modification of the layer.graphics collection ==> Buffer update
    //  - The view state becomes non-stationary ==> Only view update, no buffer update
    //  - The view state becomes stationary ==> Buffer update
    this.updatePositions(renderParameters);

    // If there is nothing to render we return.
    if (this.indexBufferSize === 0) {
      return;
    }

    // Update view `transform` matrix; it converts from map units to pixels.
    mat3.identity(this.transform);
    this.screenTranslation[0] = (state.pixelRatio * state.size[0]) / 2;
    this.screenTranslation[1] = (state.pixelRatio * state.size[1]) / 2;
    mat3.translate(this.transform, this.transform, this.screenTranslation);
    mat3.rotate(
      this.transform,
      this.transform,
      (Math.PI * state.rotation) / 180
    );
    this.screenScaling[0] = state.pixelRatio / state.resolution;
    this.screenScaling[1] = -state.pixelRatio / state.resolution;
    mat3.scale(this.transform, this.transform, this.screenScaling);
    mat3.translate(this.transform, this.transform, this.translationToCenter);

    // Update view `display` matrix; it converts from pixels to normalized device coordinates.
    this.display[0] = 2 / (state.pixelRatio * state.size[0]);
    this.display[4] = -2 / (state.pixelRatio * state.size[1]);

    // Draw.
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uTransform, false, this.transform);
    gl.uniformMatrix3fv(this.uDisplay, false, this.display);
    gl.uniform1f(this.uCurrentTime, performance.now() / 1000.0);
    gl.uniform3fv(this.uCoreColor, this.layer.coreColor);
    gl.uniform3fv(this.uGlowColor, this.layer.glowColor);
    gl.uniform1f(this.uCurrentTime, performance.now() / 1000.0);
    gl.uniform3fv(this.uCoreColor,  this.layer.coreColor);
    gl.uniform3fv(this.uGlowColor,  this.layer.glowColor);
    gl.uniform1f(this.uPulseFreq,   this.layer.pulseFreq);
    gl.uniform1f(this.uSizePx,   this.layer.sizePx);


    gl.uniform1f(this.uCoreRadius,  this.layer.coreRadius);
    gl.uniform1f(this.uGlowRadius,  this.layer.glowRadius);
    gl.uniform1f(this.uSparkAmpl,   this.layer.sparkAmpl);
    gl.uniform1f(this.uSparkFreq,   this.layer.sparkFreq);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.enableVertexAttribArray(this.aPosition);
    gl.enableVertexAttribArray(this.aOffset);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(this.aOffset, 2, gl.FLOAT, false, 16, 8);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawElements(gl.TRIANGLES, this.indexBufferSize, gl.UNSIGNED_SHORT, 0);

    // Request new render because markers are animated.
    this.requestRender();
  },

  // Called by the map view or the popup view when hit testing is required.
  // Both a map point (in map units) and a screen point are passed. In this
  // case, we only use the screen point.
  hitTest: function (_mapPoint, screenPoint) {
    // Coordinates of the clicked screen point.
    const { x, y } = screenPoint;

    // The map view.
    const view = this.view;

    if (this.layer.graphics.length === 0) {
      // Nothing to do.
      return Promise.resolve([]);
    }

    // Compute screen distance between each graphic and the test point.
    const distances = this.layer.graphics.map(graphic => {
      const graphicPoint = view.toScreen(graphic.geometry);
      return Math.sqrt(
        (graphicPoint.x - x) * (graphicPoint.x - x) +
          (graphicPoint.y - y) * (graphicPoint.y - y)
      );
    });

    // Find the minimum distance.
    let minIndex = 0;

    distances.forEach((distance, i) => {
      if (distance < distances.getItemAt(minIndex)) {
        minIndex = i;
      }
    });

    const minDistance = distances.getItemAt(minIndex);

    // If the minimum distance is more than 35 pixel then nothing was hit.
    if (minDistance > 35) {
      return Promise.resolve([]);
    }

    // Otherwise it is a hit; We set the layer as the source layer for the graphic
    // (required for the popup view to work) and we return a resolving promise to
    // the GraphicHit.
    const graphic = this.layer.graphics.getItemAt(minIndex);
    graphic.sourceLayer = this.layer;
    const graphicHit = {
      type: 'graphic',
      graphic: graphic,
      layer: this.layer,
      mapPoint: graphic.geometry
    };
    return Promise.resolve([graphicHit]);
  },

  // Called internally from render().
  updatePositions: function (renderParameters) {
    const gl = renderParameters.context;
    const stationary = renderParameters.stationary;
    const state = renderParameters.state;

    // If we are not stationary we simply update the `translationToCenter` vector.
    if (!stationary) {
      vec2.sub(this.translationToCenter, this.centerAtLastUpdate, state.center);
      this.requestRender();
      return;
    }

    // If we are stationary, the `layer.graphics` collection has not changed, and
    // we are centered on the `centerAtLastUpdate`, we do nothing.
    if (
      !this.needsUpdate &&
      this.translationToCenter[0] === 0 &&
      this.translationToCenter[1] === 0
    ) {
      return;
    }

    // Otherwise, we record the new encoded center, which imply a reset of the `translationToCenter` vector,
    // we record the update time, and we proceed to update the buffers.
    this.centerAtLastUpdate.set(state.center);
    this.translationToCenter[0] = 0;
    this.translationToCenter[1] = 0;
    this.needsUpdate = false;

    const graphics = this.layer.graphics;

    // Generate vertex data.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    const vertexData = new Float32Array(16 * graphics.length);

    let i = 0;
    graphics.forEach(graphic => {
      const point = graphic.geometry;

      // The (x, y) position is relative to the encoded center.
      const x = point.x - this.centerAtLastUpdate[0];
      const y = point.y - this.centerAtLastUpdate[1];

      vertexData[i * 16 + 0] = x;
      vertexData[i * 16 + 1] = y;
      vertexData[i * 16 + 2] = -0.5;
      vertexData[i * 16 + 3] = -0.5;
      vertexData[i * 16 + 4] = x;
      vertexData[i * 16 + 5] = y;
      vertexData[i * 16 + 6] = 0.5;
      vertexData[i * 16 + 7] = -0.5;
      vertexData[i * 16 + 8] = x;
      vertexData[i * 16 + 9] = y;
      vertexData[i * 16 + 10] = -0.5;
      vertexData[i * 16 + 11] = 0.5;
      vertexData[i * 16 + 12] = x;
      vertexData[i * 16 + 13] = y;
      vertexData[i * 16 + 14] = 0.5;
      vertexData[i * 16 + 15] = 0.5;

      ++i;
    });

    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

    // Generates index data.
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

    let indexData = new Uint16Array(6 * graphics.length);
    for (let i = 0; i < graphics.length; ++i) {
      indexData[i * 6 + 0] = i * 4 + 0;
      indexData[i * 6 + 1] = i * 4 + 1;
      indexData[i * 6 + 2] = i * 4 + 2;
      indexData[i * 6 + 3] = i * 4 + 1;
      indexData[i * 6 + 4] = i * 4 + 3;
      indexData[i * 6 + 5] = i * 4 + 2;
    }

    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);

    // Record number of indices.
    this.indexBufferSize = indexData.length;
  }
});

// Subclass the custom layer view from GraphicsLayer.
export const FlashingIncidentLayer = GraphicsLayer.createSubclass({
  properties:{
    coreColor:{value : [1.00, 0.25, 0.25]},
    glowColor:{value: [0.85, 0.10, 0.10]},
    pulseFreq: { value: 2.0 },
    coreColor:  { value: [1.00, 0.25, 0.25] },
    glowColor:  { value: [0.85, 0.10, 0.10] },
    pulseFreq:  { value: 2.0 },     // Hz
    coreRadius: { value: 4.0 },     // px
    glowRadius: { value: 16.0 },    // px
    sparkAmpl:  { value: 0.10 },    // 0 – 1
    sparkFreq:  { value: 60.0 },     // Hz
    sizePx:     { value: 70.0 }
  },
  createLayerView: function (view) {
    // We only support MapView, so we only need to return a
    // custom layer view for the `2d` case.
    if (view.type === '2d') {
      return new CustomLayerView2D({
        view: view,
        layer: this
      });
    }
  }
});
