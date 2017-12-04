

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


function ConfettiParticleEffectSystem(game, config) {
	ScreenEntity.call(this, game);
	this.stroke_style = config.stroke_style || '#fff';
	this.stroke_transition = config.stroke_transition;
	this.modulate_width = config.modulate_width;

	// this.particle_longevity = config.particle_longevity || 0.05;
	this.particle_base_timer = config.particle_base_timer || 0;
	this.particle_max_timer = config.particle_max_timer || 20;

	this.particles = [];
}
ConfettiParticleEffectSystem.prototype = Object.create(ScreenEntity.prototype);
ConfettiParticleEffectSystem.prototype.constructor = ConfettiParticleEffectSystem;
ConfettiParticleEffectSystem.prototype.class_name = 'ConfettiParticleEffectSystem';
ConfettiParticleEffectSystem.prototype.add_particle = function(start, end, width) {
	var new_particle = {
		start: start,
		end: end,
		width: width || 1,
		timer: Math.floor(Math.random() * this.particle_base_timer),
	};
	this.particles.push(new_particle);

	return new_particle;
};
ConfettiParticleEffectSystem.prototype.update = function(game) {
	for (var i = this.particles.length - 1; i >= 0; i--) {
		this.particles[i].timer++;

		if (this.particles[i].timer >= this.particle_max_timer) {
			this.particles.splice(i, 1);
		}
	}
};
ConfettiParticleEffectSystem.prototype.draw = function(ctx) {
	if (this.visible) {
		// console.log("drawing ", this.particles.length, "particles");
		for (var i = 0; i < this.particles.length; i++) {
			var p = this.particles[i];
			ctx.save();

			if (this.stroke_transition) {
				var degree = p.timer / this.particle_max_timer;
				var color = [
					this.stroke_style[0] * (1 - degree) + this.stroke_transition[0] * degree,
					this.stroke_style[1] * (1 - degree) + this.stroke_transition[1] * degree,
					this.stroke_style[2] * (1 - degree) + this.stroke_transition[2] * degree,
				];
				ctx.strokeStyle = 'rgb('+color[0]+','+color[1]+','+color[2]+')';
			} else {
				ctx.strokeStyle = this.stroke_style;
			}

			if (this.modulate_width)
				ctx.lineWidth = this.particles[i].width * (1 - this.particles[i].timer / this.particle_max_timer);
			else
				ctx.lineWidth = p.width;
			
			ctx.beginPath();
			ctx.moveTo(p.start.px, p.start.py);
			ctx.lineTo(p.end.px, p.end.py);
			ctx.stroke();

			ctx.restore();
		}
	}
};









function FighterJetBlue(game, px, py, path) {
	PathEntity.call(this, game, px, py, 32, 32, 
		image_composite(image_colorize(game.images.fighter_jet_coloring, this.color), game.images.fighter_jet_base), path);
	this.missile_store = 1;

	this.dead = false;
	this.sy = 0;
	this.angle_granularity = 5;
}
FighterJetBlue.prototype = Object.create(PathEntity.prototype);
FighterJetBlue.prototype.color = '#73f';
FighterJetBlue.prototype.update = function(game) {
	PathEntity.prototype.update.call(this, game);
	var self = this;
	
	// targeting and attacking
	var enemies = game.find_near(this, FighterJetRed, 600);
	enemies = enemies.filter(function (other) { return points_dist(self, other) > 300 && self.px < other.px; });
	if (enemies.length > 0 && this.missile_store > 0 && Math.random() < 0.1) {
		this.missile_store--;
		game.entities_to_add.push(new AirMissile(game, this.px, this.py, this.color, enemies[0]));
	}

	// death spiral
	if (this.dead) {
		this.sy += 0.1;
		this.py += this.sy;

		this.angle = point_angle(0, 0, this.path[0].sx, this.sy);

		var offset = point_offset(180 + this.angle, this.width / 2);
		game.particle_systems.large_smoke_particles.add_particle(this.px + offset.px, this.py + offset.py, 2);
	}
	
	// death plane
	if (this.py >= 300) {
		game.entities_to_remove.push(this);
	}

	var offset = point_offset(180 + this.angle, this.width / 2);
	game.particle_systems.fire_particles.add_particle(this.px + offset.px, this.py + offset.py, 1);
};
FighterJetBlue.prototype.hit = function(game, other) {
	this.dead = true;
	for (var i = 0; i < 20; i++) {
		game.particle_systems.large_smoke_particles.add_particle(this.px, this.py, 1.5);
		game.particle_systems.fire_particles.add_particle(this.px, this.py, 2);
	}
};

function FighterJetRed(game, px, py, path) {
	PathEntity.call(this, game, px, py, 32, 32, 
		image_flip(image_composite(image_colorize(game.images.fighter_jet_coloring, this.color), game.images.fighter_jet_base)), path);
	this.flare_store = 8;

	this.dead = false;
	this.sy = 0;
	this.angle_granularity = 5;
}
FighterJetRed.prototype = Object.create(PathEntity.prototype);
FighterJetRed.prototype.color = '#f33';
FighterJetRed.prototype.update = function(game) {
	PathEntity.prototype.update.call(this, game);

	var self = this;

	// detection and flare evasion
	var missiles = game.find_near(this, AirMissile, 400);
	missiles = missiles.filter(function (other) { return other.target === self; });
	if (missiles.length > 0 && this.flare_store > 0 && Math.random() < 0.5) {
		this.flare_store--;
		var flare_ent = new AirFlare(game, this.px, this.py, [
			{ timeout: 40 + Math.random() * 40, sy: 1.5, sx: this.path[0].sx + Math.random() * 3 - 1.5 }]);
		game.entities_to_add.push(flare_ent);
		if (Math.random() < 0.08) {
			missiles[0].target = flare_ent;
		}
	}

	// death spiral
	if (this.dead) {
		this.sy += 0.1;
		this.py += this.sy;

		this.angle = point_angle(0, 0, -this.path[0].sx, -this.sy);

		var offset = point_offset(this.angle, this.width / 2);
		game.particle_systems.large_smoke_particles.add_particle(this.px + offset.px, this.py + offset.py, 2);
	}

	// death plane
	if (this.py >= 300) {
		game.entities_to_remove.push(this);
	}

	var offset = point_offset(this.angle, this.width / 2);
	game.particle_systems.fire_particles.add_particle(this.px + offset.px, this.py + offset.py, 1);

	// game.particle_systems.flare_particles.add_particle(this.px + offset.px, this.py + offset.py, 2);

};
FighterJetRed.prototype.hit = function(game, other) {
	this.dead = true;
	for (var i = 0; i < 20; i++) {
		game.particle_systems.large_smoke_particles.add_particle(this.px, this.py, 1.5);
		game.particle_systems.fire_particles.add_particle(this.px, this.py, 2);
	}
};



function PTBoatBlue(game, px, py, path) {
	PathEntity.call(this, game, px, py, 96, 96, 
		image_composite(image_colorize(game.images.pt_boat_coloring, this.color), game.images.pt_boat_base), path);
	// this.missile_store = 1;

	this.dead = false;
	this.sy = 0;
	this.angle_granularity = 2;
	this.swing = 0;
}
PTBoatBlue.prototype = Object.create(PathEntity.prototype);
PTBoatBlue.prototype.color = '#73f';
PTBoatBlue.prototype.update = function(game) {
	PathEntity.prototype.update.call(this, game);
	var self = this;

	this.swing = (this.swing + 2) % 360;
	this.angle = Math.sin(this.swing / 180 * Math.PI) * 4;
	
	// // targeting and attacking
	// var enemies = game.find_near(this, FighterJetRed, 600);
	// enemies = enemies.filter(function (other) { return points_dist(self, other) > 300 && self.px < other.px; });
	// if (enemies.length > 0 && this.missile_store > 0 && Math.random() < 0.1) {
	// 	this.missile_store--;
	// 	game.entities_to_add.push(new AirMissile(game, this.px, this.py, this.color, enemies[0]));
	// }

	// // death spiral
	// if (this.dead) {
	// 	this.sy += 0.1;
	// 	this.py += this.sy;

	// 	this.angle = point_angle(0, 0, this.path[0].sx, this.sy);

	// 	var offset = point_offset(180 + this.angle, this.width / 2);
	// 	game.particle_systems.large_smoke_particles.add_particle(this.px + offset.px, this.py + offset.py, 2);
	// }
	
	// // death plane
	// if (this.py >= 300) {
	// 	game.entities_to_remove.push(this);
	// }

	// var offset = point_offset(180 + this.angle, this.width / 2);
	// game.particle_systems.fire_particles.add_particle(this.px + offset.px, this.py + offset.py, 1);
};
// PTBoatBlue.prototype.hit = function(game, other) {
// 	this.dead = true;
// 	for (var i = 0; i < 20; i++) {
// 		game.particle_systems.large_smoke_particles.add_particle(this.px, this.py, 1.5);
// 		game.particle_systems.fire_particles.add_particle(this.px, this.py, 2);
// 	}
// };



function SoldierBlue(game, px, py, path) {
	PathEntity.call(this, game, px, py, 16, 16, 
		image_composite(image_colorize(game.images.soldier_coloring, this.color), game.images.soldier_base), path);
	// this.missile_store = 1;

	this.max_frame = 4;
}
SoldierBlue.prototype = Object.create(PathEntity.prototype);
SoldierBlue.prototype.color = '#73f';
SoldierBlue.prototype.update = function(game) {
	PathEntity.prototype.update.call(this, game);
	this.frame = (this.frame + 1) % 4;

	// var self = this;

	// this.swing = (this.swing + 2) % 360;
	// this.angle = Math.sin(this.swing / 180 * Math.PI) * 4;
};





function SAMLauncherRed(game, px, py) {
	ScreenEntity.call(this, game, px, py, 64, 64, 
		image_flip(image_composite(image_colorize(game.images.sam_launcher_coloring, this.color), game.images.sam_launcher_base)));

	this.missile_decoration = new ScreenEntity(game, 0, -4, 32, 32,
		image_composite(image_colorize(game.images.sam_missile_coloring, this.color), game.images.sam_missile_base));
	this.missile_decoration.angle = -150;
	this.missile_decoration.z_index = 1;
	this.sub_entities.push(this.missile_decoration);

	this.missiles_loaded = 1;
	this.reload = 0;
	this.lock_on = 0;
}
SAMLauncherRed.prototype = Object.create(ScreenEntity.prototype);
SAMLauncherRed.prototype.color = '#f33';
SAMLauncherRed.prototype.update = function(game) {
	ScreenEntity.prototype.update.call(this, game);

	var self = this;

	// targeting and attacking
	var enemies = game.find_near(this, FighterJetBlue, 800);
	enemies = enemies.filter(function (other) { return other.px < self.px - (self.py - other.py); });
	if (enemies.length > 0 && this.missiles_loaded > 0) {
		this.lock_on++;
		if (this.lock_on === 60) {
			this.lock_on = 0;
			this.missiles_loaded--;
			game.entities_to_add.push(new SAMMissile(game, this.px, this.py - 4, this.color, enemies[0]));
		}
	} else {
		this.lock_on = 0;
	}

	// reloading
	if (this.missiles_loaded < 1) {
		this.reload++;
		if (this.reload >= 180) {
			this.reload = 0;
			this.missiles_loaded++;
		}
	}

	this.missile_decoration.visible = this.missiles_loaded > 0;
};



function AirMissile(game, px, py, color, target) {
	ScreenEntity.call(this, game, px, py, 8, 8, 
		image_composite(image_colorize(game.images.air_missile_coloring, color), game.images.air_missile_base));
	this.target = target;
	this.speed = 4;
}
AirMissile.prototype = Object.create(ScreenEntity.prototype);
AirMissile.prototype.update = function(game) {
	ScreenEntity.prototype.update.call(this, game);

	if (Math.random() < 0.5) {
		if (this.last_particle)
			this.last_particle.start = { px: this.px, py: this.py };
		this.last_particle = game.particle_systems.blue_missile_trail_particles.add_particle(this, { px: this.px, py: this.py }, 3);
	}
	// game.particle_systems.smoke_particles.add_particle(this.px, this.py, 1);
	// game.particle_systems.fire_particles.add_particle(this.px, this.py, 1);
	
	this.angle = point_angle(this.px, this.py, this.target.px, this.target.py);
	
	var offset = point_offset(this.angle, this.speed);
	this.px += offset.px;
	this.py += offset.py;

	if (points_dist(this, this.target) < this.speed) {
		this.target.hit(game, this);
		game.entities_to_remove.push(this);
	}
};

function SAMMissile(game, px, py, color, target) {
	ScreenEntity.call(this, game, px, py, 32, 32, 
		image_composite(image_colorize(game.images.sam_missile_coloring, color), game.images.sam_missile_base));
	this.target = target;
	this.speed = 6;
	this.angle_granularity = 5;
}
SAMMissile.prototype = Object.create(ScreenEntity.prototype);
SAMMissile.prototype.update = function(game) {
	ScreenEntity.prototype.update.call(this, game);

	var offset = point_offset(this.angle, this.width / 2);
	// game.particle_systems.smoke_particles.add_particle(this.px - offset.px, this.py - offset.py, 1);
	// game.particle_systems.fire_particles.add_particle(this.px - offset.px, this.py - offset.py, 1);

	if (Math.random() < 0.5) {
		if (this.last_particle)
			this.last_particle.start = { px: this.px + offset.px, py: this.py + offset.py };
		this.last_particle = game.particle_systems.red_missile_trail_particles.add_particle(this, { px: this.px + offset.px, py: this.py + offset.py }, 5);
	}
	
	this.angle = point_angle(this.px, this.py, this.target.px, this.target.py);
	
	offset = point_offset(this.angle, this.speed);
	this.px += offset.px;
	this.py += offset.py;

	if (points_dist(this, this.target) < this.speed) {
		this.target.hit(game, this);
		game.entities_to_remove.push(this);
	}
};




function AirFlare(game, px, py, path) {
	PathEntity.call(this, game, px, py, 16, 16, game.images.particle_flare, path);
	this.max_frame = 8;
	this.frame_step = 0;
	this.last_particle = undefined;
}
AirFlare.prototype = Object.create(PathEntity.prototype);
AirFlare.prototype.update = function(game) {
	PathEntity.prototype.update.call(this, game);

	this.frame_step = (this.frame_step + 1) % 16;
	this.frame = Math.floor(this.frame_step / 2);

	if (Math.random() < 0.25) {
		if (this.last_particle)
			this.last_particle.start = { px: this.px, py: this.py };
		this.last_particle = game.particle_systems.flare_trail_particles.add_particle(this, { px: this.px, py: this.py }, 5);
	}

	// 	this.flare_trail.push([this.px, this.py]);
	// 	if (this.flare_trail.length >= 5)
	// 		this.flare_trail.shift();
	// }
};
// AirFlare.prototype.draw = function(ctx) {
// 	PathEntity.prototype.draw.call(this, ctx);

// 	ctx.strokeStyle = '#a84';
// 	ctx.lineWidth = 1;

// 	for (var i = this.flare_trail.length - 1; i >= 0; i--) {
// 		ctx.beginPath();
// 		ctx.lineWidth = i * 2 + 1;
// 		if (i === this.flare_trail.length - 1) {
// 			ctx.moveTo(this.px, this.py);
// 		} else {
// 			ctx.moveTo(this.flare_trail[i+1][0], this.flare_trail[i+1][1]);
// 		}
// 		ctx.lineTo(this.flare_trail[i][0], this.flare_trail[i][1]);
// 		ctx.stroke();
// 	}
	
// };
AirFlare.prototype.hit = function(game, other) {
	game.entities_to_remove.push(this);
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
		pt_boat_base: "pt_boat_base.png",
		pt_boat_coloring: "pt_boat_coloring.png",
		sam_launcher_base: "sam_launcher_base.png",
		sam_launcher_coloring: "sam_launcher_coloring.png",
		air_missile_base: "air_missile_base.png",
		air_missile_coloring: "air_missile_coloring.png",
		sam_missile_base: "sam_missile_base.png",
		sam_missile_coloring: "sam_missile_coloring.png",
		soldier_base: "soldier_base.png",
		soldier_coloring: "soldier_coloring.png",

		particle_steam: "particle_steam.png",
		particle_flare: "particle_flare.png",
	};

	load_all_images(images, function () {
		console.log("all images loaded");


		var game = new GameSystem(canvas, images);

		game.game_systems.spawner_system = new SpawnerSystem(game, [
			{ timeout: 120, action: { spawn_entity: [
				{ class: FighterJetBlue, px: -32, py: 70, args: [ [{ timeout: 360, sx: 2.5 }], ] },
			]}},
			{ timeout: 150, action: { spawn_entity: [
				{ class: FighterJetRed, px: 640 + 32, py: 150, args: [ [{ timeout: 360, sx: -2.5 }], ] },
			]}},
			{ timeout: 300, action: { spawn_entity: [
				{ class: PTBoatBlue, px: -32, py: 400, args: [ [
					{ timeout: 330, sx: 1 },
					{ timeout: 20, repeat: 3, spawn_entity: [{ class: SoldierBlue, px: 64, args: [[
						{ timeout: 240, sx: 1 },
					]] }] },
					{ timeout: 60 },
				], ] },
			]}},
		]);
		game.particle_systems.smoke_particles = new ParticleEffectSystem(game, {
			fill_style: '#aaa',
			particle_image: game.images.particle_steam,
			particle_longevity: 0.1,
			particle_size: 8,
		});
		game.particle_systems.large_smoke_particles = new ParticleEffectSystem(game, {
			fill_style: '#222',
			particle_image: game.images.particle_steam,
			particle_longevity: 0.05,
			particle_size: 24,
		});
		game.particle_systems.fire_particles = new ParticleEffectSystem(game, {
			fill_style: '#d80',
			particle_image: game.images.particle_steam,
			particle_longevity: 0.4,
			particle_size: 8,
		});
		game.particle_systems.flare_trail_particles = new ConfettiParticleEffectSystem(game, {
			stroke_style: '#a84',
			modulate_width: true,
		});
		game.particle_systems.blue_missile_trail_particles = new ConfettiParticleEffectSystem(game, {
			stroke_style: [0x77, 0x33, 0xff],
			stroke_transition: [0xff, 0xff, 0xff],
			particle_max_timer: 40,
			modulate_width: true,
		});
		game.particle_systems.red_missile_trail_particles = new ConfettiParticleEffectSystem(game, {
			stroke_style: [0xff, 0x33, 0x33],
			stroke_transition: [0xff, 0xff, 0xff],
			particle_max_timer: 40,
			modulate_width: true,
		});
		// game.particle_systems.flare_particles = new ParticleEffectSystem(game, {
		// 	particle_image: game.images.particle_flare,
		// 	particle_size: 16,
		// 	frame_step: 0.5,
		// 	particle_sy: -4,
		// 	max_frame: 8,
		// });

		// game.entities.push(new FighterJetRed(game, 640, 100, [ { sx: -3 }]));
		// game.entities.push(new FighterJetBlue(game, -20, 150, [ { sx: 2.5 }]));
		game.entities.push(new SAMLauncherRed(game, 580, 350));

		setInterval(game.step_game_frame.bind(game, ctx), 1000 / 60);
	});
}

window.addEventListener('load', main);
