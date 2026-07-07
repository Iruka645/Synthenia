import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';

// Expose PIXI to window so pixi-live2d-display can bind to it
window.PIXI = PIXI;

// Now import Live2DModel dynamically or directly from cubism2 subpath
import { Live2DModel } from 'pixi-live2d-display/cubism2';

const MODEL_MIN_SCALE = 0.12;
const MODEL_MAX_SCALE = 0.35;

const fitModelToCanvas = (loadedModel, app) => {
  const width = Math.max(app.renderer.width, 1);
  const height = Math.max(app.renderer.height, 1);

  loadedModel.scale.set(1);
  const bounds = loadedModel.getLocalBounds();
  const boundsWidth = Math.max(bounds.width, 1);
  const boundsHeight = Math.max(bounds.height, 1);
  const scale = Math.min((width * 0.9) / boundsWidth, (height * 0.92) / boundsHeight);

  loadedModel.scale.set(Math.max(MODEL_MIN_SCALE, Math.min(scale, MODEL_MAX_SCALE)));
  loadedModel.anchor.set(0.5, 0.5);
  loadedModel.x = width / 2;
  loadedModel.y = height * 0.58 / 4;
};

export const AvatarCanvas = ({ emotion, volume }) => {
  const containerRef = useRef(null);
  const [model, setModel] = useState(null);
  const volumeRef = useRef(0);
  const tickerRef = useRef(null);

  // Sync volume to ref so PIXI ticker can read it without rebuilding
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Handle emotion changes
  useEffect(() => {
    if (!model) return;

    console.log('[Live2D] Triggering emotion motion for:', emotion);

    const playMotionSafe = (groupName) => {
      const definitions = model.internalModel?.motionManager?.definitions;
      if (!definitions) return;

      if (definitions[groupName]) {
        model.motion(groupName);
        return;
      }

      // Fallbacks mapping to standard Live2D model motion categories
      const fallbacks = {
        happy: ['tap_body', 'tap_bust', 'tap_hm', 'flick_head'],
        laugh: ['tap_body', 'tap_bust', 'tap_hm', 'flick_head'],
        embarrassed: ['tap_body', 'tap_hm', 'sleepy'],
        sad: ['sleepy', 'tap_body', 'tap_hm'],
        annoyed: ['tap_body', 'tap_bust', 'flick_head'],
        thinking: ['flick_head', 'tap_hand', 'sleepy'],
        surprised: ['flick_head', 'tap_hand']
      };

      const groupFallbacks = fallbacks[groupName] || [];
      for (const fb of groupFallbacks) {
        if (definitions[fb]) {
          model.motion(fb);
          return;
        }
      }

      // Default: play first available non-idle motion group
      const keys = Object.keys(definitions);
      const activeKeys = keys.filter(k => k !== 'idle');
      if (activeKeys.length > 0) {
        const randomKey = activeKeys[Math.floor(Math.random() * activeKeys.length)];
        model.motion(randomKey);
      }
    };

    switch (emotion) {
      case 'happy':
        playMotionSafe('happy');
        break;
      case 'laugh':
        playMotionSafe('laugh');
        break;
      case 'embarrassed':
        playMotionSafe('embarrassed');
        break;
      case 'sad':
        playMotionSafe('sad');
        break;
      case 'annoyed':
        playMotionSafe('annoyed');
        break;
      case 'thinking':
        playMotionSafe('thinking');
        break;
      case 'surprised':
        playMotionSafe('surprised');
        break;
      default:
        break;
    }
  }, [emotion, model]);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    let currentModel = null;
    const container = containerRef.current;
    const width = container.clientWidth || 320;
    const height = container.clientHeight || 450;

    // 1. Create PIXI Application (let PIXI create the canvas element)
    const app = new PIXI.Application({
      resizeTo: container,
      transparent: true,
      antialias: true,
      autoStart: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Style the PIXI generated canvas view and append to container
    app.view.style.display = 'block';
    app.view.style.width = '100%';
    app.view.style.height = '100%';
    container.appendChild(app.view);

    const handleResize = () => {
      if (currentModel) {
        fitModelToCanvas(currentModel, app);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    // 2. Load Live2D Model
    const modelUrl = '/live2d-models/syn/model.json';

    Live2DModel.from(modelUrl)
      .then((loadedModel) => {
        if (disposed) {
          loadedModel.destroy();
          return;
        }

        currentModel = loadedModel;
        app.stage.addChild(loadedModel);

        // Adjust position & scale
        fitModelToCanvas(loadedModel, app);

        // Enable interaction (looking at pointer)
        loadedModel.interactive = true;
        app.stage.interactive = true;

        app.stage.on('pointermove', (e) => {
          loadedModel.focus(e.data.global.x, e.data.global.y);
        });

        // Click interaction
        loadedModel.on('pointertap', () => {
          const definitions = loadedModel.internalModel?.motionManager?.definitions || {};
          const keys = Object.keys(definitions).filter(k => k !== 'idle');
          if (keys.length > 0) {
            const randomMotion = keys[Math.floor(Math.random() * keys.length)];
            loadedModel.motion(randomMotion);
          }
        });

        setModel(loadedModel);

        // 3. PIXI Ticker for Lip-Sync
        const syncMouth = () => {
          if (loadedModel.internalModel && loadedModel.internalModel.coreModel) {
            const coreModel = loadedModel.internalModel.coreModel;
            const mouthValue = volumeRef.current;

            if (typeof coreModel.setParamFloat === 'function') {
              coreModel.setParamFloat('PARAM_MOUTH_OPEN_Y', mouthValue);
            }
            if (typeof coreModel.setParameterValueById === 'function') {
              coreModel.setParameterValueById('PARAM_MOUTH_OPEN_Y', mouthValue);
              coreModel.setParameterValueById('ParamMouthOpenY', mouthValue);
            }
          }
        };
        tickerRef.current = syncMouth;
        app.ticker.add(syncMouth);

        console.log('[Live2D] Model loaded successfully');
      })
      .catch((error) => {
        if (!disposed) {
          console.error('[Live2D] Error loading model:', error);
        }
      });

    // Cleanup
    return () => {
      disposed = true;
      resizeObserver.disconnect();
      setModel(null);

      if (tickerRef.current) {
        app.ticker.remove(tickerRef.current);
        tickerRef.current = null;
      }

      if (currentModel) {
        app.stage.removeChild(currentModel);
        currentModel.destroy();
      }

      // Remove canvas view from container and destroy application entirely
      if (container.contains(app.view)) {
        container.removeChild(app.view);
      }
      app.destroy(true, { children: true, texture: true, baseTexture: true });
      console.log('[Live2D] Cleaned up PIXI application');
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="avatar-container"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '380px',
        background: 'rgba(30, 30, 45, 0.4)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(8px)',
        overflow: 'hidden'
      }}
    >
      {!model && (
        <div
          style={{
            position: 'absolute',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          กำลังโหลดอวตารของซิน...
        </div>
      )}
    </div>
  );
};

export default AvatarCanvas;
