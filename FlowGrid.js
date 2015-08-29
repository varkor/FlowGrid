FlowSupervisor = (function () {
	var self = {};
	// Dragged cells
	self.cells = [];
	// Interaction
	self.interact = {
		pointer : {
			dragging : false,
			position : { x : 0, y : 0},
			updatePositionGivenEvent : function (event) {
				var boundingRect = self.canvas.getBoundingClientRect();
				self.interact.pointer.position = {
					x : event.pageX - window.scrollX - boundingRect.left,
					y : event.pageY - window.scrollY - boundingRect.top
				};
				return self.interact.pointer.position;
			}
		},
		pickUp : function (source, template, data, offset, bounds) {
			self.interact.pointer.dragging = true;
			self.cells.push({
				source : source,
				template : template,
				data : data,
				offset : offset,
				bounds : bounds
			});
		}
	};
	// Set up the canvas
	self.canvas = document.createElement("canvas");
	self.canvas.style.position = "fixed";
	self.canvas.style.left = "0";
	self.canvas.style.top = "0";
	self.canvas.style.margin = "0";
	self.canvas.style.pointerEvents = "none";
	self.context = self.canvas.getContext("2d");
	window.addEventListener("resize", function () {
		self.canvas.width = window.devicePixelRatio * window.innerWidth;
		self.canvas.height = window.devicePixelRatio * window.innerHeight;
		self.canvas.style.width = window.innerWidth + "px";
		self.canvas.style.height = window.innerHeight + "px";
		self.draw();
	});
	// Layout
	self.layout = {
		confinedCellPosition : function (index, position) {
			var cell = self.cells[index];
			if (cell.bounds) {
				var bounds = cell.source.getBounds();
				return {
					x : Math.max(bounds.left + cell.bounds.origin.x, Math.min(position.x, bounds.left + cell.bounds.origin.x + cell.bounds.size.width - cell.template.size.width)),
					y : Math.max(bounds.top + cell.bounds.origin.y, Math.min(position.y, bounds.top + cell.bounds.origin.y + cell.bounds.size.height - cell.template.size.height))
				};
			} else {
				return position;
			}
		}
	};
	// Create the drawing function
	self.draw = function () {
		self.context.clearRect(0, 0, self.canvas.width, self.canvas.height);
		for (var index = 0; index < self.cells.length; ++ index) {
			var cell = self.cells[index];
			var position = {
				x : self.interact.pointer.position.x - cell.offset.x,
				y : self.interact.pointer.position.y - cell.offset.y
			};
			cell.template.draw(self.context, cell.data, self.layout.confinedCellPosition(index, position), "drag");
		}
	};
	// Respond to events
	window.addEventListener("mousemove", function (event) {
		self.interact.pointer.updatePositionGivenEvent(event);
		self.draw();
	});
	window.addEventListener("mouseup", function (event) {
		if (self.interact.pointer.dragging) {
			self.cells.forEach(function (cell) {
				if (cell.source.hasOwnProperty("receiveReturnedCells")) {
					cell.source.receiveReturnedCells([cell.data]);
				}
			});
			self.cells = [];
			FlowSupervisor.interact.pointer.dragging = false;
			self.draw();
		}
	});
	// Request methods
	self.requestDraggedCellsList = function (source) {
		return self.cells;
	};
	self.requestDraggedCells = function (source, cells) {
		var supplied = [];
		cells.forEach(function (cell) {
			var index = self.cells.indexOf(cell);
			if (index > -1) {
				supplied = supplied.concat(self.cells.splice(index, 1).map(function (cell) {
					return cell.data;
				}));
			}
		});
		if (self.cells.length === 0) {
			FlowSupervisor.interact.pointer.dragging = false;
		}
		if (supplied.length > 0) {
			self.draw();
		}
		return supplied;
	};
	self.isDragging = function (source) {
		return self.interact.pointer.dragging > 0;
	};
	self.draggedCellsAreMonotemplate = function (source, template) {
		if (arguments.length >= 2 && self.cells.length > 0 && self.cells[0].template !== template)
			return false;
		for (var index = 1; index < self.cells.length; ++ i) {
			if (self.cells[index].template !== self.cells[0].template) {
				return false;
			}
		}
		return true;
	};
	self.centreOfFocus = function (source) {
		if (self.isDragging(self)) {
			var cell = self.cells[0];
			var position = self.layout.confinedCellPosition(0, {
				x : self.interact.pointer.position.x - cell.offset.x,
				y : self.interact.pointer.position.y - cell.offset.y
			});
			position.x += cell.template.size.width / 2;
			position.y += cell.template.size.height / 2;
			return position;
		} else {
			return self.interact.pointer.position;
		}
	};

	// Actually initialise the canvas
	var initialise = function () {
		self.canvas.width = window.devicePixelRatio * window.innerWidth;
		self.canvas.height = window.devicePixelRatio * window.innerHeight;
		self.canvas.style.width = window.innerWidth + "px";
		self.canvas.style.height = window.innerHeight + "px";
		self.draw();
		document.body.appendChild(self.canvas);
	};
	if (document.readyState === "interactive" || document.readyState === "complete") {
		initialise();
	} else {
		document.addEventListener("DOMContentLoaded", initialise);
	}

	return self;
})();



FlowGrid = function (parameters) {
	var self = {};
	// Initialise the properties
	self.template = parameters.template;
	self.cells = parameters.datasource;
	self.rows = parameters.rows;
	self.columns = parameters.columns;
	self.contrainToBounds = parameters.contrainToBounds;
	self.margin = {
		x : parameters.margin.x,
		y : parameters.margin.y
	};
	self.spacing = {
		x : parameters.margin.x,
		y : parameters.margin.y
	};
	self.size = {
		width : self.columns * self.template.size.width + (self.columns - 1) * self.spacing.x + 2 * self.margin.x,
		height : self.rows * self.template.size.height + (self.rows - 1) * self.spacing.y + 2 * self.margin.y,
	};
	self.events = parameters.events;
	// Set up the canvas
	self.canvas = document.createElement("canvas");
	self.canvas.width = window.devicePixelRatio * self.size.width;
	self.canvas.height = window.devicePixelRatio * self.size.height;
	self.canvas.style.width = self.size.width + "px";
	self.canvas.style.height = self.size.height + "px";
	self.context = self.canvas.getContext("2d");
	// Layout
	self.layout = {
		displacements : [],
		cellAtPosition : function (position, overflow) {
			var index = self.layout.indexAtPosition(position, overflow);
			if (index !== null && index >= 0 && index < self.cells.length + self.layout.displacements.length && self.layout.displacements.indexOf(index) === -1) {
				return index - self.layout.displacements.filter(function (x) {
					return x <= index;
				}).length;
			}
			return null;
		},
		indexAtPosition : function (position, overflow) {
			if (arguments.length < 2 || typeof overflow === "undefined") {
				overflow = false;
			}
			var cell = {
				x : (position.x - self.margin.x + (overflow ? self.spacing.x / 2 : 0)) / (self.template.size.width + self.spacing.x),
				y : (position.y - self.margin.y + (overflow ? self.spacing.y / 2 : 0)) / (self.template.size.height + self.spacing.y)
			};
			if (cell.x >= 0 && cell.x < self.columns && (overflow || (cell.x % 1 < self.template.size.width / (self.template.size.width + self.spacing.x) && cell.y % 1 < self.template.size.height / (self.template.size.height + self.spacing.y)))) {
				return Math.floor(cell.y) * self.columns + Math.floor(cell.x);
			}
			return null;
		},
		positionOfCell : function (index) {
			if (index >= 0 && index < self.cells.length) {
				return self.layout.positionOfIndex(index + self.layout.displacements.filter(function (x) {
					return x <= index;
				}).length);
			}
			return null;
		},
		positionOfIndex : function (index) {
			return {
				x : self.margin.x + (index % self.columns) * (self.template.size.width + self.spacing.x),
				y : self.margin.y + Math.floor(index / self.columns) * (self.template.size.height + self.spacing.y)
			};
		},
		localPositionFromFlowSupervisorPosition : function (position) {
			var localBoundingRect = self.canvas.getBoundingClientRect();
			var FlowSupervisorBoundingRect = FlowSupervisor.canvas.getBoundingClientRect();
			return {
				x : position.x + FlowSupervisorBoundingRect.left - localBoundingRect.left,
				y : position.y + FlowSupervisorBoundingRect.top - localBoundingRect.top
			};
		}
	};
	// Interactions
	self.interact = {
		pointer : {
			down : null,
			hover : null,
			positionGivenEvent : function (event) {
				var boundingRect = self.canvas.getBoundingClientRect();
				return {
					x : event.pageX - window.scrollX - boundingRect.left,
					y : event.pageY - window.scrollY - boundingRect.top
				};
			}
		}
	};
	// Create the drawing function
	self.draw = {
		index : function (index, state) {
			if (index >= 0 && index < self.cells.length + self.layout.displacements.length && self.layout.displacements.indexOf(index) === -1) {
				self.template.draw(self.context, self.cells[index - self.layout.displacements.filter(function (x) {
				return x <= index;
			}).length], self.layout.positionOfIndex(index), arguments.length >= 2 && typeof state !== "undefined" ? state : null);
			} else {
				self.draw.region(self.layout.positionOfIndex(index), self.template.size);
			}
		},
		indicesFromIndex : function (start, additional, state) {
			if (arguments.length < 2) {
				additional = 0;
			}
			for (var index = start; index < self.cells.length + self.layout.displacements.length + additional; ++ index) {
				self.draw.index(index, state);
			}
		},
		cell : function (index, state) {
			self.draw.index(index + self.layout.displacements.filter(function (x) {
				return x <= index;
			}).length, state);
		},
		all : function () {
			self.draw.region({ x : 0, y : 0}, self.size);
			self.draw.indicesFromIndex(0);
		},
		region : function (origin, size) {
			parameters.draw(self.context, self.size, {
				origin : origin,
				size : size
			});
		}
	};
	self.draw.all();
	// Respond to events
	window.addEventListener("mousemove", function (event) {
		var previousDisplacements = self.layout.displacements;
		self.layout.displacements = [];
		var pointer = self.interact.pointer.positionGivenEvent(event);
		if (pointer.x >= 0 && pointer.y >= 0 && pointer.x < self.size.width && pointer.y < self.size.height) {
			if (self.interact.pointer.hover !== null) {
				self.draw.cell(self.interact.pointer.hover.index);
				self.interact.pointer.hover = null;
			}
			if (self.interact.pointer.down !== null) {
				// Initiate a drag event
				var cellPosition = self.layout.positionOfCell(self.interact.pointer.down.index);
				var offset = {
					x : self.interact.pointer.down.pointer.x - cellPosition.x,
					y : self.interact.pointer.down.pointer.y - cellPosition.y
				};
				var bounds = null;
				if (self.contrainToBounds) {
					bounds = {
						origin : { x : self.margin.x, y : self.margin.y },
						size : { width : self.size.width - 2 * self.margin.x, height : self.size.height - 2 * self.margin.y }
					};
					var columns = self.cells.length;
					if (columns < self.columns) {
						bounds.size.width = columns * self.template.size.width + (columns - 1) * self.spacing.x;
					}
					var rows = Math.ceil(self.cells.length / self.columns);
					if (rows < self.rows) {
						bounds.size.height = rows * self.template.size.height + (rows - 1) * self.spacing.y;
					}
				}
				FlowSupervisor.interact.pickUp(self, self.template, self.cells.splice(self.interact.pointer.down.index, 1)[0], offset, bounds);
				if (self.events.hasOwnProperty("cell:drag")) {
					self.events["cell:drag"](self.interact.pointer.down.index);
				}
				var index = self.interact.pointer.down.index + self.layout.displacements.filter(function (x) {
					return x <= index;
				});
				if (index < self.cells.length + self.layout.displacements.length) {
					self.layout.displacements.push(self.interact.pointer.down.index);
				}
				self.draw.indicesFromIndex(self.interact.pointer.down.index, 1);
				self.interact.pointer.down = null;
			} else if (!FlowSupervisor.isDragging(self)) {
				var index = self.layout.cellAtPosition(pointer);
				if (index !== null) {
					self.interact.pointer.hover = {
						index : index
					};
					self.draw.cell(index, "hover");
					if (self.events.hasOwnProperty("cell:hover")) {
						self.events["cell:hover"](index);
					}
				}
			}
		}
		if (FlowSupervisor.isDragging(self) && FlowSupervisor.draggedCellsAreMonotemplate(self, self.template)) {
			// Make room for the dragged cells
			var position = self.layout.localPositionFromFlowSupervisorPosition(FlowSupervisor.centreOfFocus(self));
			var index = self.layout.cellAtPosition(position, true);
			if (index !== null && index >= 0 && index < self.cells.length + self.layout.displacements.length) {
				self.layout.displacements.push(index);
				self.draw.indicesFromIndex(index, 1);
			}
		}
		var displacementHasChanged = self.layout.displacements.length !== previousDisplacements.length;
		var displacementPrevious = previousDisplacements.slice(0).sort(function (a, b) {
			return a < b ? -1 : 1;
		}), displacementNext = self.layout.displacements.slice(0).sort(function (a, b) {
			return a < b ? -1 : 1;
		});
		if (!displacementHasChanged) {
			for (var index = 0; index < displacementPrevious.length; ++ index) {
				if (displacementPrevious[index] !== displacementNext[index]) {
					displacementHasChanged = true;
					break;
				}
			}
		}
		if (displacementHasChanged) {
			self.draw.indicesFromIndex(displacementPrevious.length === 0 ? displacementNext[0] : (displacementNext.length === 0 ? displacementPrevious[0] : Math.min(displacementPrevious[0], displacementNext[0])), 1);
		}
	}, true);
	self.canvas.addEventListener("mouseleave", function (event) {
		if (self.layout.displacements.length > 0) {
			var index = self.layout.displacements.slice(0)[0];
			self.layout.displacements = [];
			self.draw.indicesFromIndex(index, 1);
		}
		if (self.interact.pointer.hover !== null) {
			self.draw.cell(self.interact.pointer.hover.index, null);
			self.interact.pointer.hover = null;
		}
	});
	self.canvas.addEventListener("mousedown", function (event) {
		event.preventDefault();
		var pointer = self.interact.pointer.positionGivenEvent(event);
		var index = self.layout.cellAtPosition(pointer);
		if (index !== null) {
			self.interact.pointer.down = {
				pointer : pointer,
				index : index
			};
			self.draw.cell(index, "action");
			if (self.events.hasOwnProperty("cell:select")) {
				self.events["cell:select"](index);
			}
		} else {
			if (self.events.hasOwnProperty("background:click")) {
				self.events["background:click"](index);
			}
		}
	});
	window.addEventListener("mouseup", function (event) {
		var pointer = self.interact.pointer.positionGivenEvent(event);
		if (self.interact.pointer.down !== null) {
			if (pointer.x >= 0 && pointer.y >= 0 && pointer.x < self.size.width && pointer.y < self.size.height) {
				self.draw.cell(self.interact.pointer.down.index, "hover");
				self.interact.pointer.down = null;
			}
		} else {
			var position = self.layout.localPositionFromFlowSupervisorPosition(FlowSupervisor.centreOfFocus(self));
			if (position.x >= 0 && position.y >= 0 && position.x < self.size.width && position.y < self.size.height) {
				var draggedCells = FlowSupervisor.requestDraggedCellsList(self);
				if (draggedCells !== null) {
					var acceptable = [];
					draggedCells.forEach(function (cell) {
						switch (cell.template) {
							case self.template:
								acceptable.push(cell);
								break;
						}
					});
					if (acceptable.length > 0) {
						var data = FlowSupervisor.requestDraggedCells(self, acceptable);
						var index = self.layout.indexAtPosition(position, true);
						var displacement = self.layout.displacements.indexOf(index);
						if (displacement !== -1) {
							self.layout.displacements.splice(displacement, 1);
						}
						if (index === null || index < 0 || index > self.cells.length + self.layout.displacements.length) {
							index = self.cells.length + self.layout.displacements.length;
						}
						Array.prototype.splice.apply(self.cells, [index, 0].concat(data));
						self.draw.indicesFromIndex(index);
						if (self.events.hasOwnProperty("cells:drop")) {
							self.events["cells:drop"](index, data);
						}
					}
				}
			}
		}
	}, true);
	// Respond to FlowSupervisor events
	self.receiveReturnedCells = function (data) {
		Array.prototype.splice.apply(self.cells, [self.cells.length, 0].concat(data));
		for (var index = self.cells.length - data.length; index < self.cells.length; ++ index) {
			self.draw.cell(index);
		}
		if (self.events.hasOwnProperty("cells:return")) {
			self.events["cells:return"](data);
		}
	};
	self.getBounds = function () {
		return self.canvas.getBoundingClientRect();
	};
	// Datasource delegation
	self.refreshDataFromSource = function (source) {
		if (arguments.length > 0) {
			self.cells = source;
		}
		self.draw.all();
	};
	return self;
};

FlowCellTemplate = function (parameters) {
	// A single FlowCellTemplate is responsible for all alike cells
	var self = {};
	// Initialise the properties
	self.size = {
		width : parameters.size.width,
		height : parameters.size.height,
	};
	// Create the drawing function
	self.draw = function (context, data, position, state) {
		parameters.draw(context, data, position, self.size, state);
	};
	return self;
};

// Useful Drawing Functions
CanvasRenderingContext2D.prototype.fillRoundedRectHD = function (x, y, width, height, cornerRadius) {
	var scale = window.devicePixelRatio;
	x *= scale;
	y *= scale;
	width *= scale;
	height *= scale;
	cornerRadius *= scale;
	this.beginPath();
	for (var offset = 0; offset < 4; ++ offset) {
		for (var angle = 0; angle <= 1; angle += 1 / 8)
			this.lineTo(
				x + width / 2 + (width / 2 - cornerRadius) * Math.sign(Math.cos((offset + 0.5) * Math.PI / 2)) + cornerRadius * Math.cos((angle + offset) * Math.PI / 2),
				y + height / 2 + (height / 2 - cornerRadius) * Math.sign(Math.sin((offset + 0.5) * Math.PI / 2)) + cornerRadius * Math.sin((angle + offset) * Math.PI / 2)
			);
	}
	this.fill();
};
// These functions make it easier to draw sharp lines on a Retina display
CanvasRenderingContext2D.prototype.fillRectHD = function (x, y, width, height) {
	var scale = window.devicePixelRatio;
	this.fillRect(x * scale, y * scale, width * scale, height * scale);
};
CanvasRenderingContext2D.prototype.setFontHD = function (name, size) {
	var scale = window.devicePixelRatio;
	this.font = size * scale + "px " + name;
};
CanvasRenderingContext2D.prototype.fillTextHD = function (text, x, y) {
	var scale = window.devicePixelRatio;
	this.fillText(text, x * scale, y * scale);
};