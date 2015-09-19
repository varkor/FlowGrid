FlowSupervisor = (function () {
	var self = {};
	// Dragged cells
	self.cells = [];
	// Interaction
	self.interact = {
		selection : null,
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
		pickUp : function (source, template, cells, offset, bounds) {
			for (var i = 0; i < cells.length; ++ i) {
				self.cells.push({
					source : source,
					template : template,
					data : cells[i].data,
					index : cells[i].index,
					offset : offset,
					bounds : bounds
				});
			}
		}
	};
	// Set up the canvas
	self.canvas = document.createElement("canvas");
	self.canvas.classList.add("flow-supervisor");
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
		if (self.isSelecting()) {
			var selection = self.requestSelection();
			if (selection.size.width > 0 && selection.size.height > 0) {
				self.context.fillStyle = "hsla(0, 0%, 100%, 0.6)";
				self.context.fillRectHD(selection.position.x, selection.position.y, selection.size.width, selection.size.height);
			}
		}
		for (var index = self.cells.length - 1; index >= 0; -- index) {
			var cell = self.cells[index];
			var multipleDragOffset = 8 * Math.min(index, 2);
			var position = {
				x : self.interact.pointer.position.x - cell.offset.x + multipleDragOffset,
				y : self.interact.pointer.position.y - cell.offset.y + multipleDragOffset
			};
			cell.template.draw(self.context, cell.data, self.layout.confinedCellPosition(index, position), ["drag"]);
		}
	};
	// Respond to events
	window.addEventListener("mousemove", function (event) {
		self.interact.pointer.updatePositionGivenEvent(event);
		if (self.isSelecting()) {
			var bounds = self.interact.selection.source.canvas.getBoundingClientRect();
			self.interact.selection.end = {
				x : Math.round(Math.max(bounds.left, Math.min(self.interact.pointer.position.x, bounds.right))),
				y : Math.round(Math.max(bounds.top, Math.min(self.interact.pointer.position.y, bounds.bottom)))
			};
		}
	}, true);
	window.addEventListener("mousemove", function (event) {
		self.draw();
	});
	window.addEventListener("mouseup", function (event) {
		if (event.button === 0) {
			var redraw = false;
			if (self.isDragging()) {
				self.cells.forEach(function (cell) {
					if (cell.source.hasOwnProperty("receiveReturnedCells")) {
						cell.source.receiveReturnedCells([cell.data]);
					}
				});
				self.cells = [];
				redraw = true;
			}
			if (self.isSelecting()) {
				self.interact.selection = null;
				redraw = true;
			}
			if (redraw) {
				self.draw();
			}
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
					return {
						data : cell.data,
						index : cell.index
					};
				}));
				if (cell.source !== source) {
					// One FlowGrid has taken another FlowGrid's cells
					cell.source.cellsHaveBeenTransferred([cell.data]);
				}
			}
		});
		if (supplied.length > 0) {
			self.draw();
		}
		return supplied;
	};
	self.requestSelection = function (source, belongingToSource) {
		if (!self.isSelecting()) {
			return null;
		}
		if (typeof belongingToSource !== "undefined") {
			if (self.interact.selection.source !== belongingToSource) {
				return null;
			}
		}
		return {
			position : {
				x : Math.min(self.interact.selection.start.x, self.interact.selection.end.x),
				y : Math.min(self.interact.selection.start.y, self.interact.selection.end.y)
			},
			size : {
				width : Math.abs(self.interact.selection.end.x - self.interact.selection.start.x),
				height : Math.abs(self.interact.selection.end.y - self.interact.selection.start.y)
			}
		};
	};
	self.isDragging = function (source) {
		return self.cells.length > 0;
	};
	self.isSelecting = function (source) {
		return self.interact.selection !== null;
	};
	self.numberOfDraggedCells = function (source) {
		return self.cells.length;
	};
	self.draggedCellsAreHomogeneous = function (source, template) {
		if (arguments.length >= 2 && self.cells.length > 0 && self.cells[0].template !== template)
			return false;
		for (var index = 1; index < self.cells.length; ++ index) {
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
	self.startSelectionForGrid = function (source) {
		self.interact.selection = {
			start : self.interact.pointer.position,
			end : self.interact.pointer.position,
			source : source
		};
	};
	self.endSelectionForGrid = function (source) {
		if (self.isSelecting() && self.interact.selection.source === source) {
			self.interact.selection = null;
			self.draw();
			return true;
		}
		return false;
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
	self.selected = [];
	self.rows = parameters.rows;
	self.columns = parameters.columns;
	self.scrollOffset = 0;
	self.contrainToBounds = parameters.contrainToBounds;
	self.locked = [];
	self.filtered = [];
	self.selection = parameters.selection;
	self.margin = {};
	var properties = ["left", "right", "top", "bottom"];
	if (typeof parameters.margin === "number") {
		for (var i = 0; i < properties.length; ++ i) {
			self.margin[properties[i]] = parameters.margin;
		}
	} else {
		if (parameters.margin.hasOwnProperty("x")) {
			self.margin.left = parameters.margin.x;
			self.margin.right = parameters.margin.x;
		}
		if (parameters.margin.hasOwnProperty("y")) {
			self.margin.top = parameters.margin.y;
			self.margin.bottom = parameters.margin.y;
		}
		for (var i = 0; i < properties.length; ++ i) {
			if (parameters.margin.hasOwnProperty(properties[i])) {
				self.margin[properties[i]] = parameters.margin[properties[i]];
			}
		}
	}
	if (typeof parameters.spacing === "number") {
		self.spacing = {
			x : parameters.spacing,
			y : parameters.spacing
		};
	} else {
		self.spacing = {
			x : parameters.spacing.x,
			y : parameters.spacing.y
		};
	}
	self.size = {
		width : self.columns * self.template.size.width + (self.columns - 1) * self.spacing.x + self.margin.left + self.margin.right,
		height : self.rows * self.template.size.height + (self.rows - 1) * self.spacing.y + self.margin.top + self.margin.bottom,
	};
	self.attachments = [];
	if (parameters.hasOwnProperty("attachments")) {
		self.attachments = parameters.attachments;
	}
	self.listeners = {};
	if (parameters.hasOwnProperty("listeners")) {
		self.listeners = parameters.listeners;
	}
	// Set up the canvas
	self.canvas = document.createElement("canvas");
	self.canvas.classList.add("flow-grid");
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
			if (typeof overflow === "undefined") {
				overflow = false;
			}
			var cell = {
				x : (position.x - self.margin.left + (overflow ? self.spacing.x / 2 : 0)) / (self.template.size.width + self.spacing.x),
				y : (position.y - self.margin.top + (overflow ? self.spacing.y / 2 : 0)) / (self.template.size.height + self.spacing.y)
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
				x : self.margin.left + (index % self.columns) * (self.template.size.width + self.spacing.x),
				y : self.margin.top + Math.floor(index / self.columns) * (self.template.size.height + self.spacing.y) - self.scrollOffset
			};
		},
		localPositionFromFlowSupervisorPosition : function (position) {
			var localBoundingRect = self.canvas.getBoundingClientRect();
			var FlowSupervisorBoundingRect = FlowSupervisor.canvas.getBoundingClientRect();
			return {
				x : position.x + FlowSupervisorBoundingRect.left - localBoundingRect.left,
				y : position.y + FlowSupervisorBoundingRect.top - localBoundingRect.top + self.scrollOffset
			};
		}
	};
	// Interactions
	self.interact = {
		pointer : {
			down : null, // Actually down on a cell
			hover : null,
			positionGivenEvent : function (event) {
				var boundingRect = self.canvas.getBoundingClientRect();
				return {
					x : event.pageX - window.scrollX - boundingRect.left,
					y : event.pageY - window.scrollY - boundingRect.top + self.scrollOffset
				};
			}
		}
	};
	// Create the drawing function
	self.draw = {
		index : function (index, states, interacting) {
			if (index >= 0 && index < self.cells.length + self.layout.displacements.length && self.layout.displacements.indexOf(index) === -1) {
				var cellIndex = index - self.layout.displacements.filter(function (x) {
					return x <= index;
				}).length;
				if (self.filtered.indexOf(cellIndex) === -1) {
					if (typeof states === "undefined") {
						states = [];
					}
					if (self.selected.indexOf(cellIndex) !== -1) {
						states.push("select");
					}
					self.template.draw(self.context, self.cells[cellIndex], self.layout.positionOfIndex(index), states, typeof interacting !== "undefined" ? interacting : null);
				} else {
					self.draw.region(self.layout.positionOfIndex(index), self.template.size);
				}
			} else {
				self.draw.region(self.layout.positionOfIndex(index), self.template.size);
			}
		},
		indicesFromIndex : function (start, additional, states) {
			if (arguments.length < 2) {
				additional = 0;
			}
			for (var index = start; index < self.cells.length + self.layout.displacements.length + additional; ++ index) {
				self.draw.index(index, states);
			}
		},
		cell : function (index, states, interacting) {
			self.draw.index(index + self.layout.displacements.filter(function (x) {
				return x <= index;
			}).length, states, interacting);
		},
		all : function () {
			self.draw.region({ x : 0, y : 0}, self.size);
			for (var index = 0, attachment; index < self.attachments.length; ++ index) {
				self.draw.attachment(index);
			}
			self.draw.indicesFromIndex(0);
		},
		region : function (origin, size) {
			parameters.draw(self.context, self.size, {
				origin : origin,
				size : size
			});
		},
		attachment : function (index) {
			var attachment = self.attachments[index];
			attachment.template.draw(self.context, attachment.position);
		}
	};
	self.draw.all();
	// Respond to events
	window.addEventListener("mousemove", function (event) {
		if (!FlowSupervisor.isSelecting()) {
			var previousDisplacements = self.layout.displacements;
			if (self.locked.indexOf("drop") === -1) {
				self.layout.displacements = [];
			}
			var pointer = self.interact.pointer.positionGivenEvent(event);
			if (pointer.x >= 0 && pointer.y - self.scrollOffset >= 0 && pointer.x < self.size.width && pointer.y - self.scrollOffset < self.size.height) {
				if (self.interact.pointer.hover !== null) {
					self.draw.cell(self.interact.pointer.hover.index);
					self.interact.pointer.hover = null;
				}
				if (self.interact.pointer.down !== null && self.locked.indexOf("drag") === -1) {
					// Initiate a drag event
					var cellPosition = self.layout.positionOfCell(self.interact.pointer.down.index);
					var offset = {
						x : self.interact.pointer.down.pointer.x - cellPosition.x,
						y : self.interact.pointer.down.pointer.y - cellPosition.y - self.scrollOffset
					};
					var bounds = null;
					if (self.contrainToBounds) {
						bounds = {
							origin : { x : self.margin.left, y : self.margin.top },
							size : { width : self.size.width - (self.margin.left + self.margin.right), height : self.size.height - (self.margin.top + self.margin.bottom) }
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
					var pickedUp = [];
					var previouslySelected = self.selected.indexOf(self.interact.pointer.down.index) === -1;
					if (self.selection === "none" || (self.locked.indexOf("select") !== -1 && previouslySelected)) {
						self.selected.push(self.interact.pointer.down.index);
					}
					self.selected.sort(function (a, b) {
						return a === b ? 0 : (a < b ? -1 : 1);
					});
					var minimumIndex = self.selected[0];
					for (var i = 0, cell; i < self.selected.length; ++ i) {
						cell = self.cells.splice(self.selected[i] - i, 1)[0];
						pickedUp.push({
							data : cell,
							index : self.selected[i]
						});
					}
					if (!self.broadcastEvent("cell:drag", self.interact.pointer.down.index, pickedUp)) {
						self.selected = [];
						FlowSupervisor.interact.pickUp(self, self.template, pickedUp, offset, bounds);
						var index = self.interact.pointer.down.index + self.layout.displacements.filter(function (x) {
							return x <= index;
						});
						if (index < self.cells.length + self.layout.displacements.length) {
							self.layout.displacements.push(self.interact.pointer.down.index);
						}
						self.draw.indicesFromIndex(minimumIndex, pickedUp.length);
					} else {
						for (cell of pickedUp) {
							self.cells.splice(cell.index, 0, cell.data);
						}
						if (previouslySelected) {
							self.selected.splice(self.selected.indexOf(self.interact.pointer.down.index), 1);
							self.draw.cell(self.interact.pointer.down.index, ["hover"]);
						}
					}
					self.interact.pointer.down = null;
				} else if (self.locked.indexOf("hover") === -1) {
					var index = self.layout.cellAtPosition(pointer);
					if (index !== null) {
						if (!FlowSupervisor.isDragging(self)) {
							self.interact.pointer.hover = {
								index : index
							};
							self.draw.cell(index, ["hover"]);
							self.broadcastEvent("cell:hover", index, self.cells[index]);
						} else if (FlowSupervisor.draggedCellsAreHomogeneous(self)) {
							self.interact.pointer.hover = {
								index : index
							};
							for (interactable of self.template.interacts) {
								if ((interactable.cardinality === "multiple" || FlowSupervisor.numberOfDraggedCells(self) === 1) && FlowSupervisor.draggedCellsAreHomogeneous(self, interactable.template)) {
									var data = FlowSupervisor.requestDraggedCellsList(self).map(x => x.data);
									self.draw.cell(index, ["interact"], interactable.cardinality === "multiple" ? data : data[0]);
									break;
								}
							}
						}
					}
				}
			}
			if (FlowSupervisor.isDragging(self) && FlowSupervisor.draggedCellsAreHomogeneous(self, self.template) && self.locked.indexOf("drop") === -1) {
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
				return a === b ? 0 : (a < b ? -1 : 1);
			}), displacementNext = self.layout.displacements.slice(0).sort(function (a, b) {
				return a === b ? 0 : (a < b ? -1 : 1);
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
		} else {
			// Respond to selection rectangle
			var selection = FlowSupervisor.requestSelection(self, self);
			if (selection !== null) {
				// Clear the previous selection
				self.deselectAll();
				// Form the new selection
				var position = self.layout.localPositionFromFlowSupervisorPosition(selection.position), size = selection.size;
				var left = (position.x - self.margin.left) / (self.template.size.width + self.spacing.x), top = (position.y - self.margin.top) / (self.template.size.height + self.spacing.y), right = (position.x + size.width - 1 - self.margin.left) / (self.template.size.width + self.spacing.x), bottom = (position.y + size.height - 1 - self.margin.top) / (self.template.size.height + self.spacing.y);
				// We can always round left and top up because we're making the assumption that a drag always starts from a point in between cells, and cells are always top-left aligned
				for (var x = Math.floor(left) + (left % 1 >= (self.template.size.width / (self.template.size.width + self.spacing.x)) ? 1 : 0); x < Math.min(self.cells.length, self.columns, Math.ceil(right)); ++ x) {
					for (var y = Math.floor(top) + (top % 1 >= (self.template.size.height / (self.template.size.height + self.spacing.y)) ? 1 : 0); y < Math.min(Math.ceil(self.cells.length / self.columns), Math.ceil(bottom)); ++ y) {
						var index = y * self.columns + x;
						self.selected.push(index);
						self.draw.cell(index);
					}
				}
			}
		}
	}, true);
	self.canvas.addEventListener("mouseleave", function (event) {
		if (self.layout.displacements.length > 0 && self.locked.indexOf("drop") === -1) {
			var index = self.layout.displacements.slice(0)[0];
			self.layout.displacements = [];
			self.draw.indicesFromIndex(index, 1);
		}
		if (self.interact.pointer.hover !== null) {
			self.draw.cell(self.interact.pointer.hover.index);
			self.interact.pointer.hover = null;
		}
	});
	self.canvas.addEventListener("mousedown", function (event) {
		if (event.button === 0) {
			event.preventDefault();
			var pointer = self.interact.pointer.positionGivenEvent(event);
			var index = self.layout.cellAtPosition(pointer);
			var previouslySelected = self.selected;
			var redrawPreviouslySelected = function () {
				for (var i = 0; i < previouslySelected.length; ++ i) {
					self.draw.cell(previouslySelected[i]);
				}
			};
			if (index !== null) {
				self.interact.pointer.down = {
					pointer : pointer,
					index : index
				};
				if (self.locked.indexOf("select") === -1 && (self.selection === "single" || self.selection === "multiple")) {
					if (self.selected.indexOf(index) === -1) {
						if (self.selection === "single" || (self.selection === "multiple" && !event.shiftKey)) {
							self.selected = [];
							redrawPreviouslySelected();
						}
						self.selected.push(index);
						self.broadcastEvent("cell:select", index);
					} else if (self.selection === "multiple" && event.shiftKey) {
						self.selected.splice(self.selected.indexOf(index), 1);
					}
					self.draw.cell(index, ["hover"]);
				}
			} else {
				if (self.locked.indexOf("select") === -1) {
					self.selected = [];
					redrawPreviouslySelected();
				}
				var eventWasAbsorbed = false;
				for (var index = 0, attachment; index < self.attachments.length; ++ index) {
					attachment = self.attachments[index];
					if (pointer.x >= attachment.position.x && pointer.y >= attachment.position.y && pointer.x < attachment.position.x + attachment.template.size.width && pointer.y < attachment.position.y + attachment.template.size.height) {
						if (attachment.template.respondToEvent("click", self, attachment.position, attachment.template.size, pointer)) {
							eventWasAbsorbed = true;
							self.draw.attachment(index);
							break;
						}
					}
				}
				if (!eventWasAbsorbed) {
					self.broadcastEvent("background:click", index);
					if (self.locked.indexOf("select") === -1 && self.selection === "multiple") {
						FlowSupervisor.startSelectionForGrid(self);
					}
				}
			}
		}
	});
	self.canvas.addEventListener("contextmenu", function (event) {
		event.preventDefault();
		var pointer = self.interact.pointer.positionGivenEvent(event);
		var index = self.layout.cellAtPosition(pointer);
		if (index !== null) {
			self.broadcastEvent("cell:contextmenu", index, self.cells[index], event);
		}
	});
	window.addEventListener("mouseup", function (event) {
		if (event.button === 0) {
			var pointer = self.interact.pointer.positionGivenEvent(event);
			if (self.interact.pointer.down !== null) {
				if (pointer.x >= 0 && pointer.y >= 0 && pointer.x < self.size.width && pointer.y < self.size.height) {
					var index = self.interact.pointer.down.index;
					self.interact.pointer.down = null;
					if (self.layout.cellAtPosition(pointer) === index) {
						if (self.locked.indexOf("hover") === -1) {
							self.draw.cell(index, ["hover"]);
						}
						self.broadcastEvent("cell:click", index, self.cells[index]);
					}
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
						if (acceptable.length > 0 && self.locked.indexOf("drop") === -1) {
							var cells = FlowSupervisor.requestDraggedCells(self, acceptable);
							var index = self.layout.indexAtPosition(position, true);
							var displacement = self.layout.displacements.indexOf(index);
							if (displacement !== -1) {
								self.layout.displacements.splice(displacement, 1);
							}
							if (index === null || index < 0 || index > self.cells.length + self.layout.displacements.length) {
								index = self.cells.length + self.layout.displacements.length;
							}
							var data = cells.map(x => x.data);
							Array.prototype.splice.apply(self.cells, [index, 0].concat(data));
							self.draw.indicesFromIndex(index);
							self.broadcastEvent("cells:drop", index, cells);
						} else if (self.interact.pointer.hover !== null) {
							var index = self.interact.pointer.hover.index;
							for (interactable of self.template.interacts) {
								if ((interactable.cardinality === "multiple" || FlowSupervisor.numberOfDraggedCells(self) === 1) && FlowSupervisor.draggedCellsAreHomogeneous(self, interactable.template)) {
									var data = draggedCells.map(x => x.data);
									if (self.broadcastEvent("cell:interact", index, self.cells[index], interactable.cardinality === "multiple" ? data : data[0])) {
										FlowSupervisor.requestDraggedCells(self, draggedCells);
									}
									break;
								}
							}
						}
					}
				}
			}
		}
	}, true);
	var lockScrollToBounds = function () {
		var rows = Math.ceil((self.cells.length + self.layout.displacements.length) / self.columns);
		var lockedScrollOffset = Math.max(0, Math.min(self.scrollOffset, rows * self.template.size.height + (rows - 1) * self.spacing.y + self.margin.top + self.margin.bottom - self.size.height));
		if (self.scrollOffset !== lockedScrollOffset) {
			self.scrollOffset = lockedScrollOffset;
			self.draw.all();
			return true;
		}
		return false;
	};
	self.canvas.addEventListener("wheel", function (event) {
		self.scrollOffset += event.deltaY;
		if (!lockScrollToBounds()) {
			self.draw.all();
		}
	});
	// Respond to FlowSupervisor events
	var clearDisplacements = () => {
		var minimumIndex = self.cells.length, additional = self.layout.displacements.length;;
		if (additional > 0) {
			self.layout.displacements.sort(function (a, b) {
				return a === b ? 0 : (a < b ? -1 : 1);
			});
			if (self.layout.displacements[0] < minimumIndex) {
				minimumIndex = self.layout.displacements[0];
			}
		}
		self.layout.displacements = [];
		self.draw.indicesFromIndex(minimumIndex, additional);
		return minimumIndex;
	};
	self.receiveReturnedCells = function (data) {
		var insertAt = clearDisplacements();
		Array.prototype.splice.apply(self.cells, [insertAt, 0].concat(data));
		for (var index = insertAt - data.length; index < self.cells.length; ++ index) {
			self.draw.cell(index);
		}
		self.broadcastEvent("cells:return");
	};
	self.cellsHaveBeenTransferred = function (data) {
		clearDisplacements();
		lockScrollToBounds();
		self.broadcastEvent("cells:transferred");
	};
	self.getBounds = function () {
		return self.canvas.getBoundingClientRect();
	};
	// Events
	self.broadcastEvent = function (event) {
		var args = [], prevent = false;
		for (var i = 1; i < arguments.length; ++ i) {
			args.push(arguments[i]);
		}
		if (self.listeners.hasOwnProperty(event)) {
			if (self.listeners[event].apply(this, args)) {
				prevent = true;
			}
		}
		return prevent;
	};

	// Datasource delegation
	self.refreshDataFromSource = function (source) {
		if (arguments.length > 0) {
			self.cells = source;
		}
		if (!lockScrollToBounds()) {
			self.draw.all();
		}
	};
	self.redrawCellAtIndex = function (index) {
		self.draw.cell(index);
	};
	self.redrawCell = function (cell) {
		self.draw.cell(self.cells.indexOf(cell));
	};
	var lockable = ["hover", "select", "drag", "drop"];
	self.lock = function (abilities) {
		if (self.locked.length !== lockable.length) {
			if (typeof abilities === "undefined") {
				abilities = lockable;
			}
			for (var i = 0; i < abilities.length; ++ i) {
				if (self.locked.indexOf(abilities[i]) === -1) {
					self.locked.push(abilities[i]);
				}
			}
			if (abilities.indexOf("hover") !== -1) {
				if (self.interact.pointer.hover !== null) {
					self.draw.cell(self.interact.pointer.hover.index);
					self.interact.pointer.hover = null;
				}
			}
			if (abilities.indexOf("select") !== -1) {
				if (self.interact.pointer.down !== null) {
					self.draw.cell(self.interact.pointer.down.index);
					self.interact.pointer.down = null;
				}
				if (FlowSupervisor.requestSelection(self, self) !== null) {
					FlowSupervisor.endSelectionForGrid(self);
				}
			}
			if (abilities.indexOf("drag") !== -1) {
				var draggedCells = FlowSupervisor.requestDraggedCellsList(self);
				if (draggedCells !== null) {
					var acceptable = [];
					draggedCells.forEach(function (cell) {
						if (cell.source === self) {
							acceptable.push(cell);
						}
					});
					if (acceptable.length > 0) {
						var cells = FlowSupervisor.requestDraggedCells(self, acceptable);
						var minimumIndex = self.cells.length;
						if (self.layout.displacements.length > 0) {
							self.layout.displacements.sort(function (a, b) {
								return a === b ? 0 : (a < b ? -1 : 1);
							});
							if (self.layout.displacements[0] < minimumIndex) {
								minimumIndex = self.layout.displacements[0];
							}
						}
						self.layout.displacements = [];
						var data = cells.map(function (x) {
							return x.data;
						});
						Array.prototype.splice.apply(self.cells, [self.cells.length, 0].concat(data));
						self.draw.indicesFromIndex(minimumIndex);
					}
				}
			}
			if (abilities.indexOf("drop") !== -1) {
				if (self.layout.displacements.length > 0) {
					var index = self.layout.displacements[0], additional = self.layout.displacements.length;
					self.layout.displacements = [];
					self.draw.indicesFromIndex(index, additional);
				}
			}
			self.broadcastEvent("grid:lock", abilities);
		}
	};
	self.unlock = function (abilities) {
		if (self.locked.length > 0) {
			if (typeof abilities === "undefined") {
				abilities = lockable;
			}
			for (var i = 0; i < abilities.length; ++ i) {
				if (self.locked.indexOf(abilities[i]) !== -1) {
					self.locked.splice(self.locked.indexOf(abilities[i]), 1);
				}
			}
			self.broadcastEvent("grid:unlock");
		}
	};
	self.deselectAll = function () {
		var previouslySelected = self.selected.slice();
		self.selected = [];
		for (var i = 0; i < previouslySelected.length; ++ i) {
			self.draw.cell(previouslySelected[i]);
		}
	};
	self.filter = function (predicate) {
		self.filtered = [];
		var minimumIndex = null;
		for (var index = 0; index < self.cells.length; ++ index) {
			if (!predicate(self.cells[index], index)) {
				self.filtered.push(index);
			} else if (minimumIndex === null) {
				minimumIndex = index;
			}
		}
		if (self.filtered.length > 0) {
			self.draw.indicesFromIndex(minimumIndex, self.filtered.length);
		}
	};

	// Attachments
	self.attachAdjuncts = function (adjuncts) {
		for (var i = 0, adjunct, position; i < adjuncts.length; ++ i) {
			var index = self.attachments.push({
				template : adjuncts[i].adjunct,
				position : {
					x : adjuncts[i].position.x,
					y : adjuncts[i].position.y
				}
			});
			self.draw.attachment(index - 1);
		}
	};
	self.attachAdjunct = function (adjunct, position) {
		return self.attachAdjuncts([adjunct, position]);
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
	self.interacts = parameters.interacts;
	// Create the drawing function
	self.draw = function (context, data, position, state, interacting) {
		parameters.draw(context, data, position, self.size, state, interacting);
	};

	return self;
};

FlowAdjunct = function (parameters) {
	// A FlowAdjunct is an entity that can respond to events (such as clicking, or receiving a drop). It is usually attached to a FlowGrid, but can stand alone.
	var self = {};
	// Initialise the properties
	self.size = {
		width : parameters.size.width,
		height : parameters.size.height
	};
	self.data = parameters.data;
	self.listeners = {};
	if (parameters.hasOwnProperty("listeners")) {
		self.listeners = parameters.listeners;
	}
	// Create the drawing function
	self.draw = function (context, position) {
		parameters.draw(context, self.data, position, self.size);
	};

	// Respondng to events
	self.respondToEvent = function (event, host, position, size) {
		// The listener should return true if it should absorb the event (so that no other listener is triggered)
		if (self.listeners.hasOwnProperty(event)) {
			var args = [];
			for (var i = 4; i < arguments.length; ++ i) {
				args.push(arguments[i]);
			}
			return self.listeners[event].apply(this, [self.data, host, position, size].concat(args));
		} else {
			return false;
		}
	};

	return self;
};

FlowAdjunct.createRowFromTemplate = function (parameters, template, data) {
	var adjuncts = [];
	for (var index = 0, adjunct, width = 0; index < parameters.columns; ++ index) {
		adjunct = {
			size : {
				width : template.size.width,
				height : template.size.height
			},
			data : {
				index : index,
				defaults : parameters.data
			}
		};
		if (parameters.adjunct.hasOwnProperty("listeners")) {
			adjunct.listeners = parameters.adjuncts.listeners;
		}
		if (typeof data !== "undefined") {
			adjunct.data.individual = data[index];
		} else {
			adjunct.data.individual = {};
		}
		for (var property in parameters.adjunct.data) {
			if (!adjunct.data.individual.hasOwnProperty(property)) {
				adjunct.data.individual[property] = parameters.adjunct.data[property];
			}
		}
		adjuncts.push({
			adjunct : FlowAdjunct(adjunct),
			position : {
				x : parameters.position.x + width,
				y : parameters.position.y
			}
		});
		width += parameters.adjunct.size.width;
	}
	return adjuncts;
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
		for (var angle = 0; angle <= 1; angle += 1 / 8) {
			this.lineTo(
				x + width / 2 + (width / 2 - cornerRadius) * Math.sign(Math.cos((offset + 0.5) * Math.PI / 2)) + cornerRadius * Math.cos((angle + offset) * Math.PI / 2),
				y + height / 2 + (height / 2 - cornerRadius) * Math.sign(Math.sin((offset + 0.5) * Math.PI / 2)) + cornerRadius * Math.sin((angle + offset) * Math.PI / 2)
			);
		}
	}
	this.fill();
};
// These functions make it easier to draw sharp lines on a Retina display
CanvasRenderingContext2D.prototype.fillRectHD = function (x, y, width, height) {
	var scale = window.devicePixelRatio;
	this.fillRect(x * scale, y * scale, width * scale, height * scale);
};
CanvasRenderingContext2D.prototype.clearRectHD = function (x, y, width, height) {
	var scale = window.devicePixelRatio;
	this.clearRect(x * scale, y * scale, width * scale, height * scale);
};
CanvasRenderingContext2D.prototype.setFontHD = function (name, size) {
	var scale = window.devicePixelRatio;
	this.font = size * scale + "px " + name;
};
CanvasRenderingContext2D.prototype.fillTextHD = function (text, x, y) {
	var scale = window.devicePixelRatio;
	this.fillText(text, x * scale, y * scale);
};
CanvasRenderingContext2D.prototype.strokeTextHD = function (text, x, y) {
	var scale = window.devicePixelRatio;
	this.strokeText(text, x * scale, y * scale);
};
CanvasRenderingContext2D.prototype.moveToHD = function (x, y) {
	var scale = window.devicePixelRatio;
	this.moveTo(x * scale, y * scale);
};
CanvasRenderingContext2D.prototype.lineToHD = function (x, y, radius, startAngle, endAngle, anticlockwise) {
	var scale = window.devicePixelRatio;
	this.lineTo(x * scale, y * scale);
};
CanvasRenderingContext2D.prototype.arcHD = function (x, y, radius, startAngle, endAngle, anticlockwise) {
	var scale = window.devicePixelRatio;
	this.arc(x * scale, y * scale, radius * scale, startAngle, endAngle, anticlockwise);
};
CanvasRenderingContext2D.prototype.arcToHD = function (x1, y1, x2, y2, radius) {
	var scale = window.devicePixelRatio;
	this.arcTo(x1 * scale, y1 * scale, x2 * scale, y2 * scale, radius * scale);
};
CanvasRenderingContext2D.prototype.copyImageHD = function (image, fromHD, toHD) {
	var scale = window.devicePixelRatio;
	var sx = 0, sy = 0, sWidth = image.width, sHeight = image.height, dx, dy, dWidth = sWidth, dHeight = sHeight;
	if (arguments.length - 2 === 3 || arguments.length - 2 === 5) {
		dx = arguments[3];
		dy = arguments[4];
	}
	if (arguments.length - 2 === 5) {
		dWidth = arguments[5];
		dHeight = arguments[6];
	}
	if (arguments.length - 2 === 7) {
		sx = arguments[3];
		sy = arguments[4];
		sWidth = arguments[5];
		sHeight = arguments[6];
		dx = arguments[7];
		dy = arguments[8];
		dWidth = arguments[9];
		dHeight = arguments[10];
	}
	this.drawImage(image, sx * (fromHD ? scale : 1), sy * (fromHD ? scale : 1), sWidth * (fromHD ? scale : 1), sHeight * (fromHD ? scale : 1), dx * (toHD ? scale : 1), dy * (toHD ? scale : 1), dWidth * (toHD ? scale : 1), dHeight * (toHD ? scale : 1));
};
CanvasRenderingContext2D.prototype.measureTextHD = function (text) {
	var scale = window.devicePixelRatio;
	return {
		width : this.measureText(text).width / scale
	};
};
CanvasRenderingContext2D.prototype.translateHD = function (x, y) {
	var scale = window.devicePixelRatio;
	this.translate(x * scale, y * scale);
};
CanvasRenderingContext2D.prototype.quadraticCurveToHD = function (cpx, cpy, x, y) {
	var scale = window.devicePixelRatio;
	this.quadraticCurveTo(cpx * scale, cpy * scale, x * scale, y * scale);
};