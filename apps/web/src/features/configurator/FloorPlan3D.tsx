'use client';

import { centralAisleRect, type RectMm, type VenueShell } from '@marquee/spatial';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';

import type { PlanGeometry } from './planGeometry';
import type { Quarter } from './usePlanView';

/** Camera elevation above the floor, in radians (about 50 degrees). */
const ELEVATION = (50 * Math.PI) / 180;

/** Platform height of a stage in metres; the backdrop uses the preset height. */
const STAGE_PLATFORM_M = 0.6;

/** Table top height in metres. */
const TABLE_HEIGHT_M = 0.75;

/** Chair marker height in metres. */
const CHAIR_HEIGHT_M = 0.45;

/** Chair marker radius in metres. */
const CHAIR_RADIUS_M = 0.23;

/** Colours read once from the design tokens so the 3D scene matches the page. */
interface PlanColors {
  readonly floor: string;
  readonly aisle: string;
  readonly stage: string;
  readonly table: string;
  readonly chair: string;
  readonly wall: string;
}

/**
 * Reads the plan colours from the CSS custom properties defined in globals.css.
 * @returns Colour strings parseable by three.js.
 */
function readPlanColors(): PlanColors {
  const styles = getComputedStyle(document.documentElement);
  /**
   * Reads one token, falling back to a neutral named colour if it is missing.
   * @param name CSS custom property name.
   * @returns Colour text.
   */
  const token = (name: string): string => styles.getPropertyValue(name).trim() || 'white';
  return {
    floor: token('--color-plan-floor'),
    aisle: token('--color-plan-aisle'),
    stage: token('--color-plan-stage'),
    table: token('--color-plan-table'),
    chair: token('--color-plan-chair'),
    wall: token('--color-line'),
  };
}

/** A point on the floor in metres: x right, z away from the entrance. */
interface FloorPoint {
  readonly x: number;
  readonly z: number;
}

/** Props for the instanced marker component. */
interface InstancedPointsProps {
  readonly points: readonly FloorPoint[];
  readonly radius: number;
  readonly height: number;
  readonly segments: number;
  readonly color: string;
}

/**
 * Draws many identical cylinders with one draw call (instancing). Used for all
 * tables and all chairs, so 500 chairs cost one geometry and one material.
 *
 * @param props Positions in metres and the cylinder shape.
 * @returns An instanced mesh. R3F disposes its geometry and material on unmount.
 */
function InstancedPoints({
  points,
  radius,
  height,
  segments,
  color,
}: InstancedPointsProps): ReactNode {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    const placeholder = new THREE.Object3D();
    points.forEach((point, index) => {
      placeholder.position.set(point.x, height / 2, point.z);
      placeholder.updateMatrix();
      mesh.setMatrixAt(index, placeholder.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [points, height, invalidate]);

  return (
    <instancedMesh
      key={points.length}
      ref={meshRef}
      args={[undefined, undefined, points.length]}
      frustumCulled={false}
    >
      <cylinderGeometry args={[radius, radius, height, segments]} />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  );
}

/**
 * Moves the orthographic camera to an orbit position looking at the hall centre.
 * @param camera Camera to move.
 * @param azimuth Rotation around the vertical axis in radians (0 looks north from the entrance).
 * @param distance Orbit radius in metres.
 * @param zoom Orthographic zoom (pixels per metre).
 */
function poseCamera(
  camera: THREE.OrthographicCamera,
  azimuth: number,
  distance: number,
  zoom: number,
): void {
  camera.position.set(
    Math.sin(azimuth) * distance * Math.cos(ELEVATION),
    distance * Math.sin(ELEVATION),
    Math.cos(azimuth) * distance * Math.cos(ELEVATION),
  );
  camera.zoom = zoom;
  camera.near = 0.1;
  camera.far = distance * 6;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

/** Props for {@link CameraRig}. */
interface CameraRigProps {
  readonly widthM: number;
  readonly depthM: number;
  readonly quarter: Quarter;
  readonly zoomFactor: number;
  readonly resetToken: number;
}

/**
 * Positions the orthographic camera for the current rotation and zoom. The move
 * is instant: there is no camera tween, so reduced-motion preferences are always
 * respected. Runs only when its inputs change, and requests one frame.
 *
 * @param props Hall size, quarter turns, zoom factor and reset signal.
 * @returns Nothing; it only adjusts the camera.
 */
function CameraRig({ widthM, depthM, quarter, zoomFactor, resetToken }: CameraRigProps): null {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) {
      return;
    }
    const sideways = quarter % 2 === 1;
    const horizontal = sideways ? depthM : widthM;
    const vertical = sideways ? widthM : depthM;
    const baseZoom = Math.min(
      size.width / (horizontal * 1.08),
      size.height / (vertical * Math.sin(ELEVATION) * 1.08 + 3),
    );
    const azimuth = (quarter * Math.PI) / 2;
    const distance = Math.max(widthM, depthM);
    poseCamera(camera, azimuth, distance, baseZoom * zoomFactor);
    invalidate();
  }, [
    camera,
    size.width,
    size.height,
    widthM,
    depthM,
    quarter,
    zoomFactor,
    resetToken,
    invalidate,
  ]);

  return null;
}

/** Props for {@link FloorPlan3D}. */
interface FloorPlan3DProps {
  readonly shell: VenueShell;
  readonly geometry: PlanGeometry | null;
  readonly quarter: Quarter;
  readonly zoomPercent: number;
  readonly resetToken: number;
  /** Stage footprint in millimetres, or null for none. */
  readonly stageRect: RectMm | null;
  readonly stageHeightMm: number;
  readonly ariaLabel: string;
  /** Called if the browser drops the WebGL context so the page can fall back to 2D. */
  readonly onContextLost: () => void;
}

/**
 * Lazily loaded three-dimensional view of the hall: floor, central aisle, stage,
 * instanced tables and chairs, an isometric-style orthographic camera and limited
 * orbit controls. Rendering is on demand (frameloop "demand"), so an idle scene
 * uses no GPU time. The canvas is decorative; the 2D plan and the text summary
 * carry the same information.
 *
 * @param props Shell, geometry and view state.
 * @returns A canvas inside a labelled frame.
 */
export default function FloorPlan3D({
  shell,
  geometry,
  quarter,
  zoomPercent,
  resetToken,
  stageRect,
  stageHeightMm,
  ariaLabel,
  onContextLost,
}: FloorPlan3DProps): ReactNode {
  const colors = useMemo(() => readPlanColors(), []);
  const floor = shell.outerRect;
  const widthM = (floor.maxXMm - floor.minXMm) / 1000;
  const depthM = (floor.maxYMm - floor.minYMm) / 1000;
  const originX = (floor.minXMm + floor.maxXMm) / 2000;
  const originZ = (floor.minYMm + floor.maxYMm) / 2000;
  const aisle = centralAisleRect(shell);

  const tablePoints = useMemo<readonly FloorPoint[]>(
    () =>
      geometry?.tables.map((table) => ({
        x: table.centre.xMm / 1000,
        z: table.centre.yMm / 1000,
      })) ?? [],
    [geometry],
  );
  const chairPoints = useMemo<readonly FloorPoint[]>(
    () =>
      geometry?.tables.flatMap((table) =>
        table.chairs.map((chair) => ({ x: chair.xMm / 1000, z: chair.yMm / 1000 })),
      ) ?? [],
    [geometry],
  );

  const stageWidthM = stageRect ? (stageRect.maxXMm - stageRect.minXMm) / 1000 : 0;
  const stageDepthM = stageRect ? (stageRect.maxYMm - stageRect.minYMm) / 1000 : 0;
  const stageCentre = stageRect
    ? {
        x: (stageRect.minXMm + stageRect.maxXMm) / 2000,
        z: (stageRect.minYMm + stageRect.maxYMm) / 2000,
      }
    : null;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-cream-deep sm:aspect-[16/10]"
    >
      <Canvas
        orthographic
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [0, 20, 20], zoom: 20 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            onContextLost();
          });
        }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[8, 16, 10]} intensity={1.4} />
        <CameraRig
          widthM={widthM}
          depthM={depthM}
          quarter={quarter}
          zoomFactor={zoomPercent / 100}
          resetToken={resetToken}
        />
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false}
          minPolarAngle={0.25}
          maxPolarAngle={1.25}
        />
        <group position={[-originX, 0, -originZ]}>
          <mesh rotation-x={-Math.PI / 2} position={[originX, 0, originZ]}>
            <planeGeometry args={[widthM, depthM]} />
            <meshStandardMaterial color={colors.floor} />
          </mesh>
          <mesh
            rotation-x={-Math.PI / 2}
            position={[
              (aisle.minXMm + aisle.maxXMm) / 2000,
              0.01,
              (aisle.minYMm + aisle.maxYMm) / 2000,
            ]}
          >
            <planeGeometry
              args={[(aisle.maxXMm - aisle.minXMm) / 1000, (aisle.maxYMm - aisle.minYMm) / 1000]}
            />
            <meshStandardMaterial color={colors.aisle} />
          </mesh>
          {stageRect && stageCentre ? (
            <>
              <mesh position={[stageCentre.x, STAGE_PLATFORM_M / 2, stageCentre.z]}>
                <boxGeometry args={[stageWidthM, STAGE_PLATFORM_M, stageDepthM]} />
                <meshStandardMaterial color={colors.stage} />
              </mesh>
              <mesh position={[stageCentre.x, stageHeightMm / 2000, stageRect.minYMm / 1000 + 0.1]}>
                <boxGeometry args={[stageWidthM, stageHeightMm / 1000, 0.15]} />
                <meshStandardMaterial color={colors.stage} transparent opacity={0.55} />
              </mesh>
            </>
          ) : null}
          <InstancedPoints
            points={tablePoints}
            radius={geometry?.template.tableRadiusMm ? geometry.template.tableRadiusMm / 1000 : 0.7}
            height={TABLE_HEIGHT_M}
            segments={28}
            color={colors.table}
          />
          <InstancedPoints
            points={chairPoints}
            radius={CHAIR_RADIUS_M}
            height={CHAIR_HEIGHT_M}
            segments={10}
            color={colors.chair}
          />
        </group>
      </Canvas>
    </div>
  );
}
