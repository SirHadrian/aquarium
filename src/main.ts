import {
  Scene,
  BoxGeometry,
  CubeTextureLoader,
  Mesh,
  WebGLRenderer,
  PerspectiveCamera,
  sRGBEncoding,
  AmbientLight,
  ColorRepresentation,
  SphereGeometry,
  MeshStandardMaterial,
  Vector3,
  Group,
  Line,
  BufferGeometry,
  LineBasicMaterial,
  Object3D,
} from 'three';
import * as dat from 'dat.gui'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';



class SceneSetup extends Scene {

  constructor() {

    super();

  }

}


class CameraSetup extends PerspectiveCamera {

  constructor( fov: number, aspectRatio: number, nearDistance: number, farDistance: number ) {

    super( fov, aspectRatio, nearDistance, farDistance );

    this.position.set( 0, 0, 200 );
    this.lookAt( 0, 0, 0 );
  }
}


class RendererSetup extends WebGLRenderer {

  constructor( configs: object, camera: CameraSetup ) {

    super( configs );

    this.setSize( window.innerWidth, window.innerHeight );
    this.setPixelRatio( window.devicePixelRatio );
    this.outputEncoding = sRGBEncoding;

    // Inject renderer to DOM
    const target = document.getElementById( "app" );
    target?.appendChild( this.domElement );

    // OrbitControls
    new OrbitControls( camera, this.domElement );
  }
}


class LightSetup extends AmbientLight {

  constructor( scene: Scene, color: ColorRepresentation, intensity: number ) {

    super( color, intensity );

    this.position.set( 0, 0, 10 );
    scene.add( this );
  }
}


class LineDirection {

  constructor() {

  }

  static create ( points: Vector3[] ) {
    const line = new Line(
      new BufferGeometry().setFromPoints( points ),
      new LineBasicMaterial( {
        color: 0xff00ff
      } )
    );
    return line;
  }
}


class Boid extends Mesh {

  #range = 100;

  constructor( geometry: SphereGeometry, material: MeshStandardMaterial ) {
    super( geometry, material );

    this.position.set( this.#range * ( Math.random() - 0.5 ), this.#range * ( Math.random() - 0.5 ), this.#range * ( Math.random() - 0.5 ) );

    this.userData.velocity = new Vector3().randomDirection();

    this.userData.acceleration = new Vector3( 0, 0, 0 );

  }
}


class Simualtion {

  #boids: Group;
  #lines: Group;

  static configs = {
    boids_number: 50,
    light_intensity: 1,
    boid_size: 0.5,
    boid_speed: 0.5,
    aligment_force: 0.1,
    cohesion_force: 0.1,
    separation_force: 1,
    aligment_radius: 10,
    cohesion_radius: 10,
    separation_radius: 10,
    container_opacity: 0.1,
    container_scale: 1,
    container_size: 100,
  }


  constructor() {

    this.#boids = new Group();
    this.#lines = new Group();

    this.#create_boids();
  }

  get boids () {
    return this.#boids;
  }

  get lines () {
    return this.#lines;
  }


  initSkyBox () {
    const skybox = new CubeTextureLoader()
      .setPath( './assets/red/' )
      .load( [
        'bkg3_right1.png',
        'bkg3_left2.png',
        'bkg3_top3.png',
        'bkg3_bottom4.png',
        'bkg3_front5.png',
        'bkg3_back6.png',
      ] );
    return skybox;
  }


  create_container () {
    const container = new Mesh(
      new BoxGeometry( Simualtion.configs.container_size, Simualtion.configs.container_size, Simualtion.configs.container_size ),
      new MeshStandardMaterial( {
        transparent: true,
        opacity: Simualtion.configs.container_opacity,
        color: 0xffffff
      } )
    );
    container.position.set( 0, 0, 0 );
    container.scale.set( Simualtion.configs.container_scale, Simualtion.configs.container_scale, Simualtion.configs.container_scale );

    return container;
  }


  separation ( boid: Object3D, boids: Group ) {

    if ( boids.children.length <= 1 ) return;

    let steering = new Vector3( 0, 0, 0 );
    let total = 0;

    boids.children.forEach( ( other ) => {

      let distance = boid.position.distanceTo( other.position );

      if ( distance < this.#configs.separation_radius ) {

        let diff = new Vector3().subVectors( boid.position, other.position );
        diff.divideScalar( this.#configs.separation_radius );

        steering.add( diff );
        total++;
      }
    } );

    steering.divideScalar( total );

    steering.multiplyScalar( this.#configs.separation_force );

    boid.userData.acceleration.add( steering );
  }


  cohesion ( boid: Object3D, boids: Group ) {

    if ( boids.children.length <= 1 ) return;

    let steering = new Vector3( 0, 0, 0 );
    let total = 0;

    boids.children.forEach( ( other ) => {

      let distance = boid.position.distanceTo( other.position );

      if ( distance < this.#configs.cohesion_radius ) {
        steering.add( other.position );
        total++;
      }
    } );

    steering.divideScalar( total );
    steering.sub( boid.position );
    steering.multiplyScalar( this.#configs.cohesion_force );

    boid.userData.acceleration.add( steering );
  }


  aligment ( boid: Object3D, boids: Group ) {

    if ( boids.children.length <= 1 ) return;

    let steering = new Vector3( 0, 0, 0 );
    let total = 0;

    boids.children.forEach( ( other ) => {

      let distance = boid.position.distanceTo( other.position );

      if ( distance < this.#configs.aligment_radius ) {
        steering.add( other.userData.velocity );
        total++;
      }
    } );

    steering.divideScalar( total );
    steering.normalize();
    steering.sub( boid.userData.velocity );
    steering.multiplyScalar( this.#configs.aligment_force );

    boid.userData.acceleration.add( steering );
  }


  checkEdges ( boid: Object3D ) {

    const negEdge = ( -50 * this.#configs.container_scale ) - this.#configs.boid_size;
    const posEdge = ( 50 * this.#configs.container_scale ) - this.#configs.boid_size;

    const offset = this.#configs.boid_size;


    if ( boid.position.x < negEdge ) {
      boid.position.x += offset;
      boid.userData.velocity.x *= -1;
    } else if ( boid.position.x > posEdge ) {
      boid.position.x -= offset;
      boid.userData.velocity.x *= -1;
    }

    if ( boid.position.y < negEdge ) {
      boid.position.y += offset;
      boid.userData.velocity.y *= -1;
    } else if ( boid.position.y > posEdge ) {
      boid.position.y -= offset;
      boid.userData.velocity.y *= -1;
    }

    if ( boid.position.z < negEdge ) {
      boid.position.z += offset;
      boid.userData.velocity.z *= -1;
    } else if ( boid.position.z > posEdge ) {
      boid.position.z -= offset;
      boid.userData.velocity.z *= -1;
    }
  }


  animateBalls () {

    // Delete lines from scene
    this.#lines.remove( ...this.#lines.children );

    if ( this.boids.children.length == 0 ) return;

    this.boids.children.forEach( ( boid ) => {

      boid.position.add(
        boid.userData.velocity
          .add( boid.userData.acceleration )
          .normalize()
          .multiplyScalar( this.#configs.boid_speed )
      );

      // Reset acceleration
      boid.userData.acceleration.multiplyScalar( 0 );

      this.aligment( boid, this.#boids );
      this.cohesion( boid, this.#boids );
      this.separation( boid, this.#boids );

      this.checkEdges( boid );

      // Draw lines
      this.#lines.add(
        LineDirection.create( [
          boid.position,
          boid.position.clone().add( boid.userData.velocity.clone().multiplyScalar( 5 ) )
        ] )
      );
    } );
  }


  #create_boids () {

    for ( let i = 0; i < this.#configs.boids_number; ++i ) {
      const boid = new Boid(
        new SphereGeometry( this.#configs.boid_size, 10, 10 ),
        new MeshStandardMaterial( {
          color: Math.random() * 0xffffff,
        } ),
      );
      this.#boids.add( boid );
    }
  }

  recreate_boids () {

    if ( this.#boids.children.length == 0 ) return;

    this.#boids.remove( ...this.#boids.children );

    this.#create_boids();
  }
}

function main () {

  //#region INIT
  // Create Scene
  const scene = new SceneSetup();

  // Create Camera
  const camera = new CameraSetup(
    50, // FOV
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.1, // Near: distance objects apear on camera
    1000, // Far: distance objects disapear from camera
  );

  // Create Renderer
  const renderer = new RendererSetup( { antialiasing: true }, camera );

  // Create light source
  const light = new LightSetup(
    scene,
    0xffffff,
    1
  );
  scene.add( light );
  //#endregion


  //#region PlayGround

  // Simualtion
  const simulation = new Simualtion();

  scene.background = simulation.initSkyBox();
  scene.add( simulation.boids );
  const container = simulation.create_container();
  scene.add( container );

  //scene.add( simulation.lines );
  //#endregion


  //#region GUI
  const gui = new dat.GUI( { width: 300 } );

  gui.add( simulation.configs, "boids_number", 10, 500, 10 ).onChange( () => simulation.recreate_boids() );
  gui.add( simulation.configs, "boid_size", 0.1, 2, 0.1 ).onChange( () => simulation.recreate_boids() );
  gui.add( simulation.configs, "boid_speed", 0.1, 2, 0.1 );

  gui.add( simulation.configs, "aligment_force", 0, 0.5, 0.05 );
  gui.add( simulation.configs, "cohesion_force", 0, 0.5, 0.05 );
  gui.add( simulation.configs, "separation_force", 1, 1.5, 0.05 );

  gui.add( simulation.configs, "aligment_radius", 5, 30, 5 );
  gui.add( simulation.configs, "cohesion_radius", 5, 30, 5 );
  gui.add( simulation.configs, "separation_radius", 5, 30, 5 );

  gui.add( simulation.configs, "container_scale", 1, 5, 1 ).onChange( () => container.scale.set( simulation.configs.container_scale, simulation.configs.container_scale, simulation.configs.container_scale ) );
  gui.add( simulation.configs, "container_opacity", 0.1, 1, 0.1 ).onChange( () => container.material.opacity = simulation.configs.container_opacity );


  //#endregion


  //#region Main loop and events

  // On window resize
  const resize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
  }
  window.addEventListener( "resize", resize, false );

  // Animation loop
  const animate = () => {

    simulation.animateBalls();

    renderer.render( scene, camera );
    requestAnimationFrame( animate );
  }
  animate();

  //#endregion
}

main();
