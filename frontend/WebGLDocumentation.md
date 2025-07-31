### 0.  Legend of the symbols you’ll see below

| Symbol          | Meaning (all floats unless noted)                        | Typical numbers with your defaults (`sizePx = 70`) |
| --------------- | -------------------------------------------------------- | -------------------------------------------------- |
| `a_position`    | Graphic’s **map** X / Y coords (relative to view-center) | e.g. (-1523.4, 348.7) m                            |
| `a_offset`      | Corner of the quad in **icon space** (-½ … +½)           | (-0.5,-0.5) ↔ (0.5, 0.5)                           |
| `u_size_px`     | Full icon size in **screen pixels**                      | 70                                                 |
| `u_transform`   | map-units ➜ **screen-px**  (mat 3)                       | depends on zoom / rotation                         |
| `u_display`     | screen-px ➜ **NDC** (-1…+1) (mat 3)                      | diag = \[2/W, -2/H]                                |
| `u_core_radius` | half cross-arm length (px)                               | 4                                                  |
| `u_arm_width`   | half arm width (px) = `armFrac · u_size_px`              | 0.18 × 70 ≈ 12.6                                   |
| `u_glow_radius` | outer glow fall-off radius (px)                          | 16                                                 |
| `u_pulse_freq`  | breathing rate (Hz)                                      | 2                                                  |
| `u_spark_freq`  | sparkle rate (Hz)                                        | 60                                                 |
| `u_spark_ampl`  | sparkle amplitude (0–1)                                  | 0.10                                               |

All colours are linear-RGB `[r,g,b]` in 0–1.

---

## 1. Vertex shader – from map units to clip space

```glsl
gl_Position.xy = u_display *
                 (u_transform * vec3(a_position,1)
                  + vec3(a_offset * u_size_px, 0)).xy;
gl_Position.zw = vec2(0,1);   // 2-D layer → always on near plane
v_offset = a_offset;          // pass unscaled offset
```

### Step-by-step for one vertex (lower-left corner)

1. **Map ➜ screen-px**

   ```
   p_screen = u_transform · [x_map, y_map, 1]^T
   ```

   `u_transform` already includes:

   * translation that puts the map origin at the screen centre
     `T_screen = [[1,0,screenW/2],[0,1,screenH/2],[0,0,1]]`
   * view rotation `R(θ)`
   * scale **pixelRatio / resolution** (map-units→px)
   * small integer translation that keeps numbers close to 0 (avoids FP drift)

2. **Add the quad corner in pixels**

   ```
   corner = a_offset * u_size_px             // (-35,-35) … (35,35)
   p_screen += [corner, 0]
   ```

3. **Screen-px ➜ NDC (-1…+1)**

   ```
   p_ndc.x =  (2 / (pixelRatio*viewW)) * p_screen.x
   p_ndc.y = -(2 / (pixelRatio*viewH)) * p_screen.y
   ```

   (negative Y because WebGL’s y-up is opposite to CSS y-down).

4. **Emit**

   ```
   gl_Position = [p_ndc.x, p_ndc.y, 0, 1]
   v_offset    = a_offset                     // still (-0.5…+0.5)
   ```

> **Result:** every graphic becomes a 70 × 70 px quad in clip space, exactly where its map-point projects on screen.

---

## 2. Fragment shader – painting the breathing cross

We work in **local icon space**:

```glsl
vec2 p = v_offset * u_size_px;   // px, centre = (0,0)
float r = length(p);             // radial distance
```

### 2.1  Signed-distance to a cross

```glsl
float d = sdCross(p,  L=u_core_radius, t=u_arm_width);
```

*Implementation*

```glsl
sdCross(p,L,t) = min(sdRect(p, vec2(L,t)),   // horizontal bar
                     sdRect(p, vec2(t,L)));  // vertical bar
```

`sdRect(p,h)` returns

```
outside :  distance  (>0)
inside  : –distance  (<0)
```

### 2.2  Three layered masks

| Name       | Formula (code)                                                                                      | At centre (p=0)    | At arm edge      | Outside glow |
| ---------- | --------------------------------------------------------------------------------------------------- | ------------------ | ---------------- | ------------ |
| **Core**   | `core = 1 – smoothstep(-1,+1,d)`                                                                    | 1                  | →0 within \~1 px | 0            |
| **Glow**   | `glow = exp(-((max(r-u_core_radius,0)/(u_glow_radius-u_core_radius))²))`                            | 1                  | \~0.78           | ≈0           |
| **Energy** | `pulse = 1 + 0.2 sin(2π t u_pulse_freq)`<br>`spark = 1 + u_spark_ampl sin(2π t u_spark_freq + rnd)` | oscillates 0.8-1.2 | idem             | idem         |

### 2.3  Colour & alpha

```glsl
vec3  rgb = core*u_core_color + glow*u_glow_color;      // mix
float a   = clamp(core + glow, 0, 1) * pulse * spark;   // composite opacity
gl_FragColor = vec4(rgb * a, a);                        // premultiplied
```

*Because blending is `gl.ONE, gl.ONE_MINUS_SRC_ALPHA`, premultiplied RGB
keeps halos additive and crisp.*

### 2.4  Sparkle randomisation

```glsl
rnd = hashp(floor(gl_FragCoord.xy / 128.0)); // one value per 128×128 tile
```

This avoids hashing every pixel and gives a subtle “twinkle” that is coherent inside a tile.

---

## 3. Numeric walkthrough – pixel at p = (10, 2)

Assume default uniforms, `time = 0.37 s`.

| Calculation                                                                                                                 | Value              |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Distance to cross**<br>`d = sdCross((10,2), 4, 12.6)`                                                                     | ≈ -10.0 → *inside* |
| **Core mask**<br>`core = 1 - smoothstep(-1,+1,-10)`                                                                         | 1                  |
| **Glow mask**<br>`r = √(10²+2²)=10.2`<br>`glow ≈ exp(-((10.2-4)/(16-4))²) ≈ 0.68`                                           | 0.68               |
| **Pulse**<br>`pulse = 1 + 0.2 sin(2π·0.37·2) ≈ 1.18`                                                                        |                    |
| **Spark** (let rnd=0.53) <br>`spark = 1 + 0.10 sin(2π·0.37·60 + 3.33) ≈ 0.95`                                               |                    |
| **α**<br>`a = clamp(1+0.68,0,1)*1.18*0.95 = 1*1.12 ≈ 1.12 → clamped to 1`                                                   | 1                  |
| **RGB**<br>`rgb = core*coreColor + glow*glowColor`<br>` = 1·(1,0.25,0.25) + 0.68·(0.85,0.1,0.1)`<br>` ≈ (1.58, 0.32, 0.32)` |                    |
| **Premultiplied**<br>`rgb*a = (1.58,0.32,0.32)`                                                                             |                    |

> After clamping to displayable 0-1 range the pixel shows the solid red cross body, slightly brightened by the pulse and spark factors.

---

## 4. Linking back to the WebGL pipeline

1. **Vertex stage** – positions quad in clip space, passes small local coords.
2. **Rasteriser** – creates fragments only inside that quad.
3. **Fragment stage** – builds the distance-field cross, adds breathing & sparkle, outputs premultiplied colour.
4. **Blending** – front-to-back α-blend with background (or other icons).
5. **Animation loop** – `requestRender()` every frame ensures `u_current_time` updates, so pulse & sparkle animate even when the map is stationary.

You can now trace **any pixel** of any icon from geographic coordinates all the way to the final RGBA that hits the framebuffer – plenty of ammunition for Thursday’s deep-dive. Good luck!
