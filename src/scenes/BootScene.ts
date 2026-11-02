import Phaser from 'phaser';
import { buildTextures } from '../textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    buildTextures(this);
    const params = new URLSearchParams(window.location.search);
    this.scene.start(params.has('bot') || params.has('go') ? 'Game' : 'Menu');
  }
}
