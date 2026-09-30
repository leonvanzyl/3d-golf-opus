import './ui/style.css';
import { Game } from './game/Game.js';

const game = new Game();
game.start();
// handy for debugging from the console
window.__golf = game;
