

function image_colorize (image, fill_style) {
	var buffer_canvas = document.createElement('canvas');
	buffer_canvas.width = image.width;
	buffer_canvas.height = image.height;
	var buffer_context = buffer_canvas.getContext('2d');
	buffer_context.imageSmoothingEnabled = false;

	buffer_context.fillStyle = fill_style;
	buffer_context.fillRect(0,0, buffer_canvas.width, buffer_canvas.height);

	buffer_context.globalCompositeOperation = "destination-atop";
	buffer_context.drawImage(image, 0, 0);

	return buffer_canvas;
}

function image_composite(bottom_image, top_image) {
	var buffer_canvas = document.createElement('canvas');
	buffer_canvas.width = bottom_image.width;
	buffer_canvas.height = bottom_image.height;
	var buffer_context = buffer_canvas.getContext('2d');
	buffer_context.imageSmoothingEnabled = false;

	buffer_context.drawImage(bottom_image, 0, 0);
	buffer_context.drawImage(top_image, 0, 0);

	return buffer_canvas;
}

function image_flip(image) {
	var buffer_canvas = document.createElement('canvas');
	buffer_canvas.width = image.width;
	buffer_canvas.height = image.height;
	var buffer_context = buffer_canvas.getContext('2d');
	buffer_context.imageSmoothingEnabled = false;

	buffer_context.translate(image.width, 0);
	buffer_context.scale(-1, 1);
	buffer_context.drawImage(image, 0, 0);

	return buffer_canvas;
}



function FighterJetBlue(game, px, py, path) {
	PathEntity.call(this, game, px, py, 32, 32, 
		image_composite(image_colorize(game.images.fighter_jet_coloring, this.color), game.images.fighter_jet_base), path);
	this.fired = false;
}
FighterJetBlue.prototype = Object.create(PathEntity.prototype);
FighterJetBlue.prototype.color = '#73f';
FighterJetBlue.prototype.update = function(game) {
	PathEntity.prototype.update.call(this, game);
	var enemies = game.find_near(this, FighterJetRed, 600);

	if (enemies.length > 0 && !this.fired && Math.random() < 0.1) {
		this.fired = true;
		game.entities_to_add.push(new AirMissile(game, this.px, this.py, this.color, enemies[0]));
	}
};
FighterJetBlue.prototype.hit = function(game, other) {
	game.entities_to_remove.push(this);
};

function FighterJetRed(game, px, py, path) {
	PathEntity.call(this, game, px, py, 32, 32, 
		image_flip(image_composite(image_colorize(game.images.fighter_jet_coloring, this.color), game.images.fighter_jet_base)), path);
	this.dead = false;
	this.sy = 0;
	this.angle_granularity = 5;
}
FighterJetRed.prototype = Object.create(PathEntity.prototype);
FighterJetRed.prototype.color = '#f33';
FighterJetRed.prototype.update = function(game) {
	PathEntity.prototype.update.call(this, game);

	if (this.dead) {
		this.sy += 0.2;
		this.py += this.sy;

		this.angle = point_angle(0, 0, -this.path[0].sx, -this.sy);

		var offset = point_offset(this.angle, this.width / 2);
		game.particle_systems.smoke_particles.add_particle(this.px + offset.px, this.py + offset.py, 2);
	}

	var offset = point_offset(this.angle, this.width / 2);
	game.particle_systems.fire_particles.add_particle(this.px + offset.px, this.py + offset.py, 1);
	if (this.py >= 300) {
		console.log('pop');
		game.entities_to_remove.push(this);
	}
};
FighterJetRed.prototype.hit = function(game, other) {
	this.dead = true;
	for (var i = 0; i < 20; i++) {
		game.particle_systems.large_smoke_particles.add_particle(this.px, this.py, 1.5);
		game.particle_systems.fire_particles.add_particle(this.px, this.py, 2);
	}
};



function AirMissile(game, px, py, color, target) {
	ScreenEntity.call(this, game, px, py, 8, 8, 
		image_composite(image_colorize(game.images.air_missile_coloring, color), game.images.air_missile_base));
	this.target = target;
	this.speed = 8;
}
AirMissile.prototype = Object.create(ScreenEntity.prototype);
AirMissile.prototype.update = function(game) {
	ScreenEntity.prototype.update.call(this, game);

	game.particle_systems.smoke_particles.add_particle(this.px, this.py, 1);
	game.particle_systems.fire_particles.add_particle(this.px, this.py, 1);
	
	this.angle = point_angle(this.px, this.py, this.target.px, this.target.py);
	
	var offset = point_offset(this.angle, this.speed);
	this.px += offset.px;
	this.py += offset.py;

	if (points_dist(this, this.target) < this.speed) {
		this.target.hit(game, this);
		game.entities_to_remove.push(this);
	}
};






function SpawnerSystem(game, cycle_paths) {
	PathEntity.call(this, game, 0,0);
	this.cycle_paths = cycle_paths;
	for (var i = 0; i < this.cycle_paths.length; i++) {
		this.cycle_paths[i].max_timeout = this.cycle_paths[i].timeout;
	}
}
SpawnerSystem.prototype = Object.create(PathEntity.prototype);
SpawnerSystem.prototype.update = function(game) {
	for (var i = 0; i < this.cycle_paths.length; i++) {
		this.cycle_paths[i].timeout--;
		if (this.cycle_paths[i].timeout <= 0) {
			this.trigger_path_action(game, this.cycle_paths[i].action);
			this.cycle_paths[i].timeout = this.cycle_paths[i].max_timeout;
		}
	}
};
SpawnerSystem.prototype.draw = function(ctx) {};


function main () {
	var canvas = document.querySelector('#game_canvas');
	var ctx = canvas.getContext('2d');
	ctx.imageSmoothingEnabled = false;



	var images = {
		ufo: "ufo.png",

		fighter_jet_base: "fighter_jet_base.png",
		fighter_jet_coloring: "fighter_jet_coloring.png",
		air_missile_base: "air_missile_base.png",
		air_missile_coloring: "air_missile_coloring.png",

		particle_steam: "particle_steam.png",
	};

	load_all_images(images, function () {
		console.log("all images loaded");


		var game = new GameSystem(canvas, images);

		game.game_systems.spawner_system = new SpawnerSystem(game, [
			{ timeout: 120, action: { spawn_entity: [
				{ class: FighterJetBlue, px: -32, py: 70, args: [ [{ timeout: 360, sx: 5 }], ] },
			]}},
			{ timeout: 150, action: { spawn_entity: [
				{ class: FighterJetRed, px: 640 + 32, py: 150, args: [ [{ timeout: 360, sx: -5 }], ] },
			]}},
		]);
		game.particle_systems.smoke_particles = new ParticleEffectSystem(game, {
			fill_style: '#444',
			particle_image: game.images.particle_steam,
			particle_longevity: 0.1,
			particle_size: 8,
		});
		game.particle_systems.large_smoke_particles = new ParticleEffectSystem(game, {
			fill_style: '#222',
			particle_image: game.images.particle_steam,
			particle_longevity: 0.02,
			particle_size: 24,
		});
		game.particle_systems.fire_particles = new ParticleEffectSystem(game, {
			fill_style: '#d80',
			particle_image: game.images.particle_steam,
			particle_longevity: 0.4,
			particle_size: 8,
		});

		// game.entities.push(new FighterJetRed(game, 640, 100, [ { sx: -3 }]));
		// game.entities.push(new FighterJetBlue(game, -20, 150, [ { sx: 2.5 }]));

		setInterval(game.step_game_frame.bind(game, ctx), 1000 / 60);
	});
}

window.addEventListener('load', main);
