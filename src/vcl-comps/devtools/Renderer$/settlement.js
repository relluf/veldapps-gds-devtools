"use ./Util, vcl/ui/Button, vcl/ui/Tab, papaparse/papaparse, amcharts, amcharts.serial, amcharts.xy, lib/node_modules/regression/dist/regression, ";

const regression = require("lib/node_modules/regression/dist/regression");
const js = require("js");

const GDS = require("./Util");

const Button = require("vcl/ui/Button");
const Tab = require("vcl/ui/Tab");
const Control = require("vcl/Control");

/*-
	* `#VA-20230130-1` 
		- sub classing Renderer<gds> 
		- Adding traxial variant
		- Refactoring into two components
			- Renderer<gds.settlement>
			- Renderer<gds.triaxial>
	
	- "entry point": vcl/Action#refresh.on

*/

function makeChart(c, opts) {
	
	function render(options) {
		var node = options.node || this.getNode();
	
		this.print(this.vars("am"));
		
		var defaults = {
		    mouseWheelZoomEnabled: true, zoomOutText: " ", 
		    mouseWheelScrollEnabled: false,
		    // chartScrollbar: {
		    //     oppositeAxis: true,
		    //     offset: 30,
		    //     scrollbarHeight: 20,
		    //     backgroundAlpha: 0,
		    //     selectedBackgroundAlpha: 0.1,
		    //     selectedBackgroundColor: "#888888",
		    //     graphFillAlpha: 0,
		    //     graphLineAlpha: 0.5,
		    //     selectedGraphFillAlpha: 0,
		    //     selectedGraphLineAlpha: 1,
		    //     autoGridCount: true,
		    //     color: "#AAAAAA"
		    // },
		    chartCursor: {
		        // pan: true,
		        valueLineEnabled: true,
		        valueLineBalloonEnabled: true,
		    	categoryBalloonDateFormat: "D MMM HH:NN",
		    	color:"black",
		        cursorAlpha:0.5,
		        cursorColor:"#e0e0e0",
		        valueLineAlpha:0.2,
		        valueZoomable:true
		    },
		    
		    // processCount: 1000,
		    // processTimeout: 450,
			// autoMarginOffset: 10,
			// autoMargins: false,
			// marginLeft: 60,
			// marginBottom: 30,
			// marginTop: 30,
			// marginRight: 30,
		
			numberFormatter: { decimalSeparator: ",", thousandsSeparator: "" },
			
		    type: "xy",  
		    colors: ["rgb(56, 121, 217)", "black"],
		    // legend: { useGraphSettings: true },
			dataProvider: this.vars("am.data"),
			// minValue: 1, maxValue: 0,
		    valueAxes: [{
		        id: "y1", position: "left",
		        reversed: true
			}, {
				position: "bottom", 
				logarithmic: options.xAxisLogarithmic,
				title: options.xAxisTitle
			}]
		};
		options = js.mixIn(defaults, options);
		options.graphs = options.graphs || this.vars("am.series").map(serie => {
			return js.mixIn({
	        	type: "line", lineThickness: 2,
		        connect: serie.connect || false,
			    xField: serie.categoryField || "x", yField: serie.valueField || "y",
			    yAxis: serie.yAxis || "y1"
		    }, serie);
		});
		
		// var serializing = this.vars(["pdf"]);
		var serializing = this.ud("#graphs").hasClass("pdf");
		
		options.valueAxes.forEach(ax => {
			ax.includeGuidesInMinMax = true;
			if(serializing) {
				delete ax.title;
			} else {
				ax.zoomable = true;
			}
			// ax.ignoreAxisWidth = true;
			// ax.inside = true;
		});
		// options.valueAxes.forEach(ax => ax.precision = 4);
		var emit = (a, b) => {
			// this.print("emit: " + a, b);
			this.emit(a, b);
		};
		var chart = AmCharts.makeChart(node, options);

		this.vars("am.chart", chart);
		// this.print("rendering", options);

		chart.addListener("drawn", (e) => emit("rendered", [e, "drawn"]));
		chart.addListener("dataUpdated", (e) => emit("rendered", [e, "dataUpdated"]));
		chart.addListener("rendered", (e) => emit("rendered", [e]));
		chart.chartCursor.addListener("moved", (e) => emit("cursor-moved", [e]));
		// chart.addListener("init", (e) => emit("rendered", [e, "init"]));
		// chart.addListener("zoomed", (e) => emit("zoomed", [e]));
		// chart.addListener("changed", (e) => emit("changed", [e]));
	}
	
	opts.immediate ? render.apply(c, [opts || {}]) : c.nextTick(() => render.apply(c, [opts || {}]));
}

/* Other */
function getSelectedGraph(cmp) {
	var graph;
	if(cmp instanceof Tab) {
		graph = cmp.getControl();
	} else {
		graph = cmp.ud("#tabs-graphs").getSelectedControl(1).getControl();
	}
	return {
		id: graph.getName().substring("graph".length + 1).toLowerCase(),
		multiple: graph.hasClass("multiple")
	};
}

/* Event Handlers */
const handlers = {
	/* Event Handlers */
	"#tabs-sections onChange": function tabs_change(newTab, curTab) {
		this.ud("#bar").setVisible(newTab && (newTab.vars("bar-hidden") !== true));
	},
	"#tabs-graphs onChange": function graphs_change(newTab, curTab) {
		var teg = this.ud("#toggle-edit-graph"), egs = this.ud("#edit-graph-stage");
		var state = teg.getState();
	
		if(state === true) {
			// commits pending changes
			teg.execute();
		}
		
		var multiple = (newTab.vars("multiple") === true);
		teg.setVisible(!multiple);
		egs.setVisible(multiple);
		
		if(!multiple) {
			var vars = this.vars(["variables"]), sg = getSelectedGraph(newTab);
			this.ud("#label-boven").setValue(js.get(js.sf("overrides.%s.label-boven", sg.id), vars) || "3-4");
			this.ud("#label-onder").setValue(js.get(js.sf("overrides.%s.label-onder", sg.id), vars) || "1-2");
		}
		
		if(state === true) {
			this.setTimeout("foo", () => teg.execute(), 500);
			// this causes UI state to become unstable - really not happy with the way it's organized Action stuff
		}
	},
	
	"#panel-edit-graph > vcl/ui/Input onChange": function() {
		this.setTimeout("foo", () => {
			var sg = getSelectedGraph(this); 
			if(!sg.multiple) {
				var vars = this.vars(["variables"]), path = js.sf("overrides.%s.%s", sg.id, this._name);
				var current = js.get(path, vars), value = this.getValue();
				
				if(current !== value) {
					js.set(path, value, vars);
					if(current !== undefined) {
						this.ud("#modified").setState(true);
					}	
				} else {
					this.print("ignore onChange");
				}
			}
		}, 750);
	},
	"#graph_Casagrande cursor-moved": GDS.TrendLine.cursorMoved,
	"#graph_Taylor cursor-moved": GDS.TrendLine.cursorMoved,
	"#graph_Bjerrum_e cursor-moved": GDS.TrendLine.cursorMoved,
	"#graph_Bjerrum_r cursor-moved": GDS.TrendLine.cursorMoved,
	"#graph_Isotachen cursor-moved": GDS.TrendLine.cursorMoved,
	"#graph_Isotachen_c cursor-moved": GDS.TrendLine.cursorMoved,
	"#graph_Koppejan cursor-moved": GDS.TrendLine.cursorMoved,

	"#graph_Casagrande onRender"() {
		this.setTimeout("render", () => {
			var vars = this.vars(["variables"]) || { stages: [] };
			var selected = js.get("overrides.casagrande.stage", vars) || [3];

			/*- reset */
			var content = [], st;
			for(st = 0; st < vars.stages.length; ++st) {
				content.push(js.sf("<div>Stage %s</div>", st));
			}
			this._node.innerHTML = content.join("");
			this.vars("rendering", true);
			
			var render = () => {
				var stage = vars.stages[st];
				var series = [{
					title: js.sf("Zetting trap %s [µm]", st + 1),
					valueAxis: "y1", valueField: "y_casagrande", 
					categoryField: "minutes"
				}];
				this.vars("am", { series: series, stage: stage, data: stage.measurements.slice(1) });
				this.vars("am-" + st, this.vars("am"));
				makeChart(this, {
					immediate: true,
					node: this.getChildNode(st),
					trendLines: GDS.cp(stage.casagrande.trendLines || []),
				    valueAxes: [{
				        id: "y1", position: "left", reversed: true,
						guides: GDS.cp(stage.casagrande.guides.filter(guide => guide.position === "left" || guide.position === "right"))
					}, {
						id: "x1", position: "bottom",
						title: js.sf("Trap %s: zetting [µm] / tijd [minuten] → ", st + 1),
						guides: GDS.cp(stage.casagrande.guides.filter(guide => guide.position === "top" || guide.position === "bottom")),
						logarithmic: true
					}]
				});
					
				if(++st < vars.stages.length) {
					this.nextTick(render);
				} else {
					selected.forEach(selected => this.getChildNode(selected - 1).classList.add("selected"));
					this.vars("rendering", false);
				}
			};
	
			st = 0; vars.stages.length && render();
		}, 125);
	},
	"#graph_Taylor onRender"() {
		this.setTimeout("render", () => {
			var vars = this.vars(["variables"]) || { stages: [] };
			var selected = js.get("overrides.taylor.stage", vars) || [3];
	
			/*- reset */
			var content = [], st;
			for(st = 0; st < vars.stages.length; ++st) {
				content.push(js.sf("<div>Stage %s</div>", st));
			}
			this._node.innerHTML = content.join("");
			
			this.vars("rendering", true);
			var render = () => {
				var stage = vars.stages[st];
			    var series = [{
					title: js.sf("Zetting trap %s [µm]", st + 1),
					valueAxis: "y1", valueField: "y_taylor",
					categoryField: "minutes_sqrt"
				}];
		
				this.vars("am", { series: series, stage: stage, data: stage.measurements });
				this.vars("am-" + st, this.vars("am"));
				makeChart(this, {
					immediate: true,
					legend: false,
					node: this.getChildNode(st),
					trendLines: GDS.cp(stage.taylor.trendLines || []),
				    valueAxes: [{
				        id: "y1", position: "left", reversed: true,
						guides: GDS.cp(stage.taylor.guides || [])
					}, {
						title: js.sf("Trap %s: zetting [µm] / tijd [√ minuten] → ", st + 1),
						position: "bottom"
					}]
				});
		
				if(++st < vars.stages.length) { 
					this.nextTick(render); 
				} else {
					selected.forEach(selected => this.getChildNode(selected - 1).classList.add("selected"));
					this.vars("rendering", false);
				}
			};
	
			st = 0; vars.stages.length && render();
		}, 125);
	},
	"#graph_Isotachen_c onRender"() {
		this.setTimeout("render", () => {
			var vars = this.vars(["variables"]) || { stages: [] };
			var selected = js.get("overrides.isotachen_c.stage", vars) || [3];
	
			/*- reset */
			var content = [], st;
			for(st = 0; st < vars.stages.length; ++st) {
				content.push(js.sf("<div>Stage %s</div>", st));
			}
			this._node.innerHTML = content.join("");
			this.vars("rendering", true);
			
			var render = () => {
				var stage = vars.stages[st];
				var series = [{
					title: js.sf("Natuurlijke rek trap %s [-]", st + 1),
					valueAxis: "y1", valueField: "y_isotachen_c", 
					categoryField: "minutes"
				}];
				this.vars("am", { series: series, stage: stage, data: stage.measurements.slice(1) });
				this.vars("am-" + st, this.vars("am"));
				makeChart(this, {
					immediate: true,
					node: this.getChildNode(st),
					trendLines: GDS.cp(stage.isotachen.trendLines || []),
				    valueAxes: [{
				        id: "y1", position: "left", reversed: true,
						guides: GDS.cp(stage.isotachen.guides.filter(guide => guide.position === "left" || guide.position === "right"))
					}, {
						id: "x1", position: "bottom",
						title: js.sf("Trap %s: natuurlijke rek [-] / tijd [minuten] → ", st + 1),
						guides: GDS.cp(stage.isotachen.guides.filter(guide => guide.position === "top" || guide.position === "bottom")),
						logarithmic: true
					}]
				});
					
				if(++st < vars.stages.length) {
					this.nextTick(render);
				} else {
					selected.forEach(selected => this.getChildNode(selected - 1).classList.add("selected"));
					this.vars("rendering", false);
				}
			};
	
			st = 0; vars.stages.length && render();
		}, 125);
	},
	"#graph_Bjerrum_e onRender"() {
		this.setTimeout("render", () => {
			var vars = this.vars(["variables"]) || { stages: [] };
			var series = [{ title: "Poriëngetal (e) [-]" }];
			
			var data = vars.bjerrum.data_e;
			var points = vars.bjerrum.points_e;
			var LLi_e = vars.bjerrum.LLi_e;
			var min_X = data.reduce((m, s) => (m = Math.min(m, s.x)), Number.MAX_SAFE_INTEGER);
			var trendLines = [{
				initialXValue: LLi_e.sN1N2.x, initialValue: LLi_e.sN1N2.y,
				finalXValue: LLi_e.sN1N2.x, finalValue: 100,
				lineColor: "red", lineAlpha: 0.25,
				dashLength: 2
			}, {
				initialXValue: LLi_e.sN1N2.x, initialValue: LLi_e.sN1N2.y,
				finalXValue: 0.1, finalValue: LLi_e.sN1N2.y,
				lineColor: "red", lineAlpha: 0.25,
				dashLength: 2
			}];
			
			if(points) {
				trendLines.push({
					initialXValue: points[0].x, initialValue: points[0].y,
					finalXValue: points[1].x, finalValue: points[1].y,
					lineColor: "red", editable: true
				}, {
					initialXValue: points[2].x, initialValue: points[2].y,
					finalXValue: points[3].x, finalValue: points[3].y,
					lineColor: "red", editable: true
				});
			} else {
				trendLines.push({
					initialXValue: data[1].x, initialValue: data[1].y,
					finalXValue: LLi_e.b1 * Math.pow(LLi_e.g1, data[2].y),
					finalValue: data[2].y,
					lineColor: "red", editable: true
				}, {
					finalXValue: data[2].x, finalValue: data[2].y,
					initialXValue: LLi_e.b2 * Math.pow(LLi_e.g2, data[0].y),
					initialValue: data[0].y,
					lineColor: "red", editable: true
				});
			}
	
			this.vars("am", { series: series, data: data });
			
			makeChart(this, { 
				type: "xy",
				trendLines: trendLines,
			    valueAxes: [{
			        id: "y1", position: "left", 
			        guides: [{
						value: LLi_e.sN1N2.y, inside: true, lineAlpha: 0, 
						label: js.sf("e0: %.3f", LLi_e.sN1N2.y)
					}]
			    }, {
					position: "bottom", title: "Belasting [kPa] → ",
					logarithmic: true, minimum: min_X * 0.9,
					guides: [{
						position: "top",
						value: LLi_e.sN1N2.x, inside: true, lineAlpha: 0,
						label: js.sf("Pg: %.3f kPa", LLi_e.sN1N2.x)
					}]
				}]
			});
		}, 125);
	},
	"#graph_Bjerrum_r onRender"() {
		this.setTimeout("render", () => {
			var vars = this.vars(["variables"]) || { stages: [] };
			var series = [{ title: "Verticale rek [∆H / Ho]", yAxis: "y2" }];
			var data = vars.bjerrum.data_rek;
			var points = vars.bjerrum.points_rek;
			var LLi_rek = vars.bjerrum.LLi_rek;
			var min_X = data.reduce((m, s) => (m = Math.min(m, s.x)), Number.MAX_SAFE_INTEGER);
			var trendLines = [{
				initialXValue: LLi_rek.sN1N2.x, initialValue: LLi_rek.sN1N2.y,
				finalXValue: LLi_rek.sN1N2.x, finalValue: 0,
				lineColor: "red", lineAlpha: 0.25,
				dashLength: 2
			}, {
				initialXValue: LLi_rek.sN1N2.x, initialValue: LLi_rek.sN1N2.y,
				finalXValue: 0.1, finalValue: LLi_rek.sN1N2.y,
				lineColor: "red", lineAlpha: 0.25,
				dashLength: 2
			}];

			if(points) {
				trendLines.push({
					initialXValue: points[0].x, initialValue: points[0].y,
					finalXValue: points[1].x, finalValue: points[1].y,
					lineColor: "red", editable: true
				}, {
					initialXValue: points[2].x, initialValue: points[2].y,
					finalXValue: points[3].x, finalValue: points[3].y,
					lineColor: "red", editable: true
				});
			} else {
				trendLines.push({
					initialXValue: data[1].x, initialValue: data[1].y,
					finalXValue: LLi_rek.b1 * Math.pow(LLi_rek.g1, data[2].y),
					finalValue: data[2].y,
					lineColor: "red", editable: true
				}, {
					finalXValue: data[2].x, finalValue: data[2].y,
					initialXValue: LLi_rek.b2 * Math.pow(LLi_rek.g2, data[0].y),
					initialValue: data[0].y,
					lineColor: "red", editable: true
				});
			}

			this.vars("am", { series: series, meta: { LLi_rek: LLi_rek }, data: data });
					
			makeChart(this, {  
				type: "xy",
				trendLines: trendLines,
			    valueAxes: [{
			    	id: "y2", position: "left", reversed: true,
			        guides: [{
						value: LLi_rek.sN1N2.y, inside: true, lineAlpha: 0, 
						label: js.sf("Rek: %.3f %%", LLi_rek.sN1N2.y * 100)
					}]
			    }, {
					position: "bottom", title: "Belasting [kPa] → ",
					logarithmic: true, minimum: min_X * 0.9,
					guides: [{
						position: "top",
						value: LLi_rek.sN1N2.x, inside: true, lineAlpha: 0,
						label: js.sf("Pg: %.3f kPa", LLi_rek.sN1N2.x)
					}]
				}]
			});
		}, 125);
	},
	"#graph_Isotachen onRender"() {
		this.setTimeout("render", () => {
			var vars = this.vars(["variables"]) || { stages: [] };
			var series = [{
				title: "Natuurlijke verticale (Hencky) rek (-ln(1 - (∆H / Ho)) [%]",
				valueField: "y"
			}];
			var data = vars.isotachen.data_e;
			var points = vars.isotachen.points_e;
			var LLi_e = vars.isotachen.LLi_e;
			
			var trendLines = [{
					initialXValue: LLi_e.sN1N2.x, initialValue: 0,
					finalXValue: LLi_e.sN1N2.x, finalValue: LLi_e.sN1N2.y,
					lineColor: "red", lineAlpha: 0.25, dashLength: 2
				}, {
					initialXValue: 0.1, initialValue: LLi_e.sN1N2.y,
					finalXValue: LLi_e.sN1N2.x,  finalValue: LLi_e.sN1N2.y,
					lineColor: "red", lineAlpha: 0.25, dashLength: 2
				}];
				
			if(points) {
				trendLines.push({
						initialXValue: points[0].x, initialValue: points[0].y,
						finalXValue: points[1].x, finalValue: points[1].y,
						lineColor: "red", editable: true
					}, {
						initialXValue: points[2].x, initialValue: points[2].y,
						finalXValue: points[3].x, finalValue: points[3].y,
						lineColor: "red", editable: true
					});
			} else {
				trendLines.push({
						initialXValue: data[1].x, initialValue: data[1].y,
						finalXValue: LLi_e.b1 * Math.pow(LLi_e.g1, data[2].y), finalValue: data[2].y,
						lineColor: "red", editable: true
					}, {
						finalXValue: data[2].x, finalValue: data[2].y,
						initialXValue: LLi_e.b2 * Math.pow(LLi_e.g2, data[0].y),
						initialValue: data[0].y,
						lineColor: "red", editable: true
					});
			}

			this.vars("am", { series: series, data: data });
			makeChart(this, { 
				type: "xy",
				trendLines: trendLines,
				valueAxes: [{
			        id: "y1", position: "left", reversed: true,
					guides: [{
						value: LLi_e.sN1N2.y, inside: true, lineAlpha: 0,
						label: js.sf("Rek: %.3f %%", LLi_e.sN1N2.y * 100)
					}]
				}, {
					position: "bottom", title: "Belasting [kPa] → ",
					minimum: data[0].x * 0.75,
					logarithmic: true,
					guides: [{
						value: LLi_e.sN1N2.x, inside: true, lineAlpha: 0, position: "top",
						label: js.sf("Pg: %.3f kPa", LLi_e.sN1N2.x, LLi_e.sN1N2.y * 100)
					}]
				}]
			});
		}, 125);
	},
	"#graph_Koppejan onRender"() {
		this.setTimeout("render", () => {
			
			var vars = this.vars(["variables"]);
			var series = [{ 
				title: "Zetting [mm]", xAxis: "x1", yAxis: "y1",
				xField: "daysT", yField: "y_koppejan"
			}, {
				title: "Zetting 1dags [mm]", xAxis: "x2", yAxis: "y1",
				xField: "x2", yField: "ez1"
			}, {
				title: "Zetting 10-daags [mm]", xAxis: "x2", yAxis: "y1",
				xField: "x2", yField: "ez10",
				lineColor: "blue", dashLength: 3, lineThickness: 1
			}]
			.concat([1,2,3,4,5,6].map(_ => ({
				title: js.sf("Verschoven zetting vz%d [mm]", _ + 1), 
				xAxis: "x1", yAxis: "y2",
				xField: "x" + (_ + 2), yField: "vz0",
				lineColor: _ >= 4 ? "purple" : "red", lineThickness: 1
			})));
		
			var serie2 = vars.koppejan.serie2;
			var trendLines = GDS.cp(vars.koppejan.trendLines);
			var LLi_1 = vars.koppejan.LLi_1;
			var max_X = vars.stages.reduce((m, s) => (m = Math.max(m, s.target)), 0);
			
			if(max_X < 10000) {
				max_X = Math.max(1000, max_X > 500 ? 10000 : max_X);
			}

			this.vars("am", { series: series, data: vars.measurements.slice(1) });
			
			makeChart(this, { 
				type: "xy",
				colors: ["black", "rgb(56, 121, 217)"],
			    valueAxes: [{
			        id: "y1", reversed: true, minimum: 0,
				}, {
			        id: "y2", position: "right", reversed: true, minimum: 0,
			        synchronizeWith: "y1", synchronizationMultiplier: 1,
					guides: [{
						value: LLi_1.sN1N2.y, inside: true, lineAlpha: 0,
						label: js.sf("%.3f %%", LLi_1.sN1N2.y / vars.Hi * 100),
					}],
				}, {
					id: "x1", title: "Duur [dagen] → ", position: "bottom", 
					logarithmic: true, minimum: 0.01, maximum: max_X
				}, {
					id: "x2", _title: "Belasting [kPa] → ", position: "top",
					synchronizeWith: "x1", synchronizationMultiplier: 1,
					logarithmic: true, minimum: 0.01,
					guides: [{
						value: LLi_1.sN1N2.x, inside: true, lineAlpha: 0,
						label: js.sf("%.3f kPa", LLi_1.sN1N2.x)
					}]
				}],
				trendLines: trendLines
			});
			
		}, 125);
	}
};

/* Setup (must be called in same order) */
function setup_casagrande(vars) {
	return GDS.setup_casagrande(vars);
}
function setup_taylor(vars) {
	return GDS.setup_taylor(vars);
}
function setup_bjerrum(vars) {
	return GDS.setup_bjerrum(vars);
}
function setup_isotachen(vars) {
	return GDS.setup_isotachen(vars);
}
function setup_koppejan(vars) { 
	/*- initialize y attribute */
	vars.measurements.forEach(m => {
		m.x2 = m[GDS.key_as];
		m.y = (m.y_koppejan = m[GDS.key_d]); // reset because of Taylor/CG
		m.trap = "Trap-" + m.stage;
	});
	
	/*- ignore the 1st ... */
	var measurements = vars.measurements.slice(1);

	var serie2, slopes = [], x = GDS.key_t, y = GDS.key_d;
	var slope_variant = 2;
	var rlines = [];

	// serie2 references only the (7) points where y2 are set, and its z10, z100, z1000, z10000 values will be calculated later on (references the last measurements of each stage)
	serie2 = vars.stages.map(stage => stage.measurements[stage.measurements.length - 1]);
	serie2.forEach(m => m.y2 = m[GDS.key_as]); // koppejan

	/*- determine for each stage its slope-info (rc, np) - based on measurements 
		(which are "verschoven" already based upon previous rc/np/stage) */
	vars.stages.forEach((stage, s) => {
		/* select all measurements for the current stage s+1 (NOTE: s starts at 0) */
		var z1 = measurements.filter(_ => _.stage === (s + 1));
		
		/* register the slope */
		var slope = {
			stage: s + 1,
			measurements: z1,
			last: z1[z1.length - 1],
			/* do a linear regression for log10(t - t1) and the "verschoven zetting" (if available otherwise use [y]) */
			regression_linear: regression.linear(z1.slice(15).map(m => [
				Math.log10(m.days), m.vz0 || m[y]
			]), { precision: 9 } )
		};

		/* copy lr info to slope */
		var rl = slope.regression_linear;
		slope.rc = rl.equation[0];
		slope.np = rl.equation[1];
		slopes.push(slope);

		/* extrapolate next stage */
		if(s < vars.stages.length - 1) {
			/* select all measurements for the next stage s+2 (NOTE: s starts at 0) */
			var z2 = measurements.filter(_ => _.stage === (s + 2));
			var t1 = (s + 1); // end of current stage / begin next stage in days

			/* for each measurement of the next stage... */
			z2.forEach((obj, i) => {
				if(!i) return; // skip the first (t - t1 === 0)
				
				var t = obj.daysT; // time in days since begin of Test (> t1)
				// record stage_time in attribute x[stage_number] so that it can be used to plot the extrapolated stages 
				obj['x' + (s + 3)] = (t - t1) || GDS.treatZeroAs;
				
				// superpositiebeginsel: vz2(ta-t1) = z1(ta-t1) + z2(ta-t1).
				obj.z1 = slope.np + slope.rc * Math.log10(t); // previous stages extrapolated
				obj.z2 = obj[y] - obj.z1; // (actual measurement) - z1 => z2

				// calculate "verschoven zetting" 
				obj.vz0 = obj[y];
				slopes.slice(0, s + 1).forEach((slope, i) => {
					/* 2021/04/27 s.paznoriega@gmail.com
						- vz4(t-3) 
							= z(t)	+ rc1 log((t-1) / (t-0))
									+ rc2 log((t-2) / (t-1)) 
									+ rc3 log((t-3) / (t-2))
						- vz3(t-2) 
							= z(t)	+ rc1 log((t-1) / (t-0))
									+ rc2 log((t-2) / (t-1)) 
						- vz2(t-1) 
							= z(t)	+ rc1 log((t-1) / (t-0))

					 * CUR pagina 41
						= z(t)  + rc1 (log(t-t1) - log(t)) 
        						+ rc2 (log(t-t2) - log(t-t1)) 
        						+ rc3 (log(t-t3) - log(t-t2)) 	
        						
						= z(t)	+ rc1·[log (t-t1) - log(t)] 
								+ rc2·[log (t-t2) - log(t-t1)] 
								+ rc3·[log (t-t3) - log(t-t2)] 
								+ .. 
								+ rc(n-2)·[log(t-t(n-2)) - log(t-tn-3)]
								+ rc(n-1)·[log(t-t(n-1)) - rc(n-1)·log(t-t(n-2))] <<< ????
					*/
					obj.vz0 += (obj['vz0_'+(i+1)] = slope.rc * (Math.log10( (t-(i+1)) / (t-i))));
					// obj.vz0 += (obj['vz0_'+(i+1)] = slope.rc * (Math.log10( (t-i) / (t-(i+1)))));
				});
			});
		}
	});

	// calculate "geëxtrapoleerde zetting"

	function calc_KJ() {
		var LLi_1, points;	
		var trendLines = slopes.map((S, i, slopes) => {
	
			function extrp(n, t) {
				/* 2021/04/27 SPN: (https://chat.openai.com/share/95a6fa34-25eb-4f10-9fd4-658de99b026a / https://chat.openai.com/c/1366a171-07fd-4007-bafa-fe090f42ee18 -- used to verify correctness)
				    - extrp4(t-3) 
					    = np4	+ rc1 log((t-0) / (t-1)) 
					    		+ rc2 log((t-1) / (t-2)) 
					    		+ rc3 log((t-2) / (t-3)) 
					    		+ rc4 log((t-3))
					- extrp3(t-2) 
						= np3	+ rc1 log((t-0) / (t-1)) 
								+ rc2 log((t-1) / (t-2))
								+ rc3 log((t-2))
					- extrp2(t-1)
						= np2	+ rc1 log((t-0) / (t-1)) 
								+ rc2 log((t-1))
					- extrp1(t-0)
						= np1	+ rc1 log((t-0))
				 * CUR pagina 41 
					= npn	+ rc1 * [log (t) - log (t-t1)]
							+ rc2 * [log (t-t1) - log (t-t2)]
							+ .... 
							+ rc(n-1) * [log (t-t(n-2)) - log (t-t(n-1))]
							+ rc(n) *    log (t-t(n-1))
				*/
				// if(t === 1) return slopes[n].last[GDS.key_d]; // uncomment to return settlement after 1 day
				
				var ez = slopes[n].np + slopes[n].rc * Math.log10(t > n ? t - n : 1);
				while(t > n && n--) { // extrapoleer voor t > t(n) (zie: https://raw.githubusercontent.com/relluf/screenshots/master/uPic/202401/20240110-104245-rzxRdl.png)
					ez += slopes[n].rc * (Math.log10( ((t - n) / (t - (n + 1)) )));
				}
				return ez;
			}
			
			serie2[i].ez1 = extrp(i, 1);
			serie2[i].ez10 = extrp(i, 10);
			serie2[i].ez100 = extrp(i, 100);
			serie2[i].ez1000 = extrp(i, 1000);
			serie2[i].ez10000 = extrp(i, 10000);
			
			return [{
				initialXValue: 1, initialValue: S.np,
				finalXValue: 20, finalValue: S.np + S.rc * Math.log10(20),
				lineAlpha: 1, lineColor: "black", dashLength: 3
			}];
		});
		if((points = js.get("overrides.koppejan.points_pg", vars))) {
			points.forEach(m => { m.y_koppejan = m.y; });
			LLi_1 = GDS.log_line_intersect(
					points[0].x, points[0].y_koppejan, points[1].x, points[1].y_koppejan, 
					points[2].x, points[2].y_koppejan, points[3].x, points[3].y_koppejan);
		} else {
			serie2.forEach(m => m.y = (m.y_koppejan = m[GDS.key_d])); // reset
			LLi_1 = GDS.log_line_intersect(
					serie2[0].x2, serie2[0].y_koppejan, serie2[1].x2, serie2[1].y_koppejan, 
					serie2[2].x2, serie2[2].y_koppejan, serie2[3].x2, serie2[3].y_koppejan);
		}
		
		if(points) {
			trendLines.push({
				initialXValue: points[0].x, initialValue: points[0].y,
				finalXValue: points[1].x, finalValue: points[1].y,
				lineColor: "red", editable: true
			}, {
				initialXValue: points[2].x, initialValue: points[2].y,
				finalXValue: points[3].x, finalValue: points[3].y,
				lineColor: "red", editable: true
			});
		} else {
			trendLines.push({
				initialXValue: serie2[1].x2,  initialValue: serie2[1].y,
				finalXValue: LLi_1.b1 * Math.pow(LLi_1.g1, serie2[2].y),
				finalValue: serie2[2].y,
				lineColor: "red", editable: true
			}, {
				initialXValue: LLi_1.b2 * Math.pow(LLi_1.g2, serie2[0].y),
				initialValue: serie2[0].y,	
				finalXValue: serie2[2].x2, finalValue: serie2[2].y,
				lineColor: "red", editable: true
			});
		}
	
		trendLines.push({
			initialXValue: LLi_1.sN1N2.x, initialValue: LLi_1.sN1N2.y,
			finalXValue: LLi_1.sN1N2.x, finalValue: 0,
			lineColor: "red", lineAlpha: 0.25,
			dashLength: 2
		}, {
			initialXValue: LLi_1.sN1N2.x, initialValue: LLi_1.sN1N2.y,
			finalXValue: 1000, finalValue: LLi_1.sN1N2.y,
			lineColor: "red", lineAlpha: 0.25,
			dashLength: 2
		});
	
		vars.koppejan = {
			serie2: serie2,
			slopes: slopes,
			LLi_1: LLi_1,
			trendLines: trendLines.flat(),
			point_pg: points,
			regression: regression,
			update() { calc_KJ(); }
		};
		
		/*- calculate Cp, Cs, C, C10, ...  */
	
		var sig = GDS.key_as;
		vars.stages.forEach((stage, st) => {
			/* 1. 1/Cp = d Ev / ln( ov + dov / ov )	*/
			stage.koppejan = slopes[st];
	
			if(st === vars.stages.length - 1) return;
			
			var d = Math.log(vars.stages[st + 1].target / stage.target);
			var d10 = Math.log10(vars.stages[st + 1].target / stage.target); 
			// var d = Math.log(serie2[st + 1][sig] / serie2[st + 0][sig]);
			// var d10 = Math.log10(serie2[st + 1][sig] / serie2[st + 0][sig]);
			var H = vars.Hi;
	
			var Cp = 1 / (((serie2[st + 1].ez1 - serie2[st + 0].ez1) / H) / d);
			var Cs = 1 / (((serie2[st + 1].ez10 - serie2[st + 0].ez10) / H) / d - (1 / Cp));
			var C = (1 / ((serie2[st + 1].y - serie2[st + 0].y) / H)) * d;
			var C10 = (1 / ((serie2[st + 1].y - serie2[st + 0].y) / H)) * d10;
	
			slopes[st].Cp = Cp;
			slopes[st].Cs = Cs;
			slopes[st].C = C;
			slopes[st].C10 = C10;
		});
	}
	
	calc_KJ();
}

function setup_stages_2(vars, only_this_stage) {
	return GDS.setup_stages_2(vars, only_this_stage);
}
function setup_parameters(root, vars, headerValue) {
	vars.categories = [{
		name: "Project",
		items: [
			{ name: "Projectnummer", value: headerValue("Job reference", false) },
			{ name: "Locatie", value: headerValue("Job Location", false)  },
			{ name: "Aantal trappen", value: vars.stages.length },
			{ name: "Proef periode", value: js.sf("%s - %s", headerValue("Date Test Started", false), headerValue("Date Test Finished", false)) },
			{ name: "Beproevingstemperatuur", value: headerValue("Sample Date") || ""},
			{ name: "Opmerking van de proef", value: "-" },
			// { name: "Opdrachtgever", value: "" },
			// { name: "Opdrachtnemer", value: "" },
			// { name: "Coördinaten", value: "" }
		]
	}, {
		name: "Monster",
		items: [
			{ name: "Boring", value: headerValue("Borehole", false) },
			{ name: "Monster", value: headerValue("Sample Name", false) },
			{ name: "Monstertype", value: headerValue("Specimen Type", false) },
			{ name: "Grondsoort", value: headerValue("Description of Sample", false) },
			{ name: "Diepte", unit: "m-NAP", value: headerValue("Depth", false) },

			// { name: "Opstelling nr", value: "" },
			// { name: "Laborant", value: "" },
			// { name: "Uitwerking", value: "" },
			// { name: "Proefmethode", value: "" },
			// { name: "Proefomstandigheden", value: "" },
			// { name: "Monsterpreparatie", value: "" },
			// { name: "Opmerking monster", value: "" }
		]
	}, {
		name: "Initiële waarden",
		items: [
			{ symbol: "Hi", name: "Hoogte", unit: "mm", value: vars.Hi },
			{ symbol: "D", name: "Diameter", unit: "mm", value: vars.D },
			{ symbol: "ρs", name: "Dichtheid vaste delen", unit: "Mg/m3", value: vars.ps },
			{				name: "Bepaling dichtheid", value: headerValue("Specific Gravity (ass", false).replace("Ingeschaat", "Ingeschat").replace("Hoobs", "Hobbs") },
			{ symbol: "Vi", name: "Volume", unit: "mm3", value: vars.Vi },
			{ symbol: "Sri", name: "Verzadigingsgraad", unit: "%", value: vars.Sri },
			{ symbol: "w0", name: "Watergehalte", unit: "%", value: vars.w0 },
			{ symbol: "yi", name: "Volumegewicht nat", unit: "kN/m3", value: vars.yi },
			{ symbol: "ydi", name: "Volumegewicht droog", unit: "kN/m3", value: vars.ydi },
			{ symbol: "ei", name: "Poriëngetal", unit: "-", value: vars.ei }
		]
	}, {
		name: "Uiteindelijke waarden",
		items: [
			{ symbol: "Hf", name: "Hoogte", unit: "mm", value: vars.Hf },
			{ symbol: "Vf", name: "Volume", unit: "mm3", value: vars.Vf },
			{ symbol: "Srf", name: "Verzadigingsgraad", unit: "%", value: vars.Srf },
			{ symbol: "wf", name: "Watergehalte", unit: "%", value: vars.wf },
			{ symbol: "yf", name: "Volumegewicht nat", unit: "kN/m3", value: vars.yf },
			{ symbol: "ydf", name: "Volumegewicht droog", unit: "kN/m3", value: vars.ydf },
			{ symbol: "ef", name: "Poriëngetal", unit: "-", value: vars.ef }
		]
	}, {
		name: "Belastingschema",
		items: vars.stages.map((stage, i) => ({ name: js.sf("Trap %d", i + 1), symbol: "σ'v", unit: "kPa", value: stage.target })),
	}, {
		name: "Belastingschema (effectief)",
		items: vars.stages.map((stage, i) => ({ name: js.sf("Trap %d", i + 1), symbol: "σ'v", unit: "kPa", value: stage.effective })),
	}, {
		name: "Grensspanning",
		items: [
			{ name: "Bjerrum/e", unit: "kPa", symbol: "σ'p", value: js.get("bjerrum.LLi_e.sN1N2.x", vars) + 0},
			{ name: "Bjerrum/NEN", unit: "kPa", symbol: "σ'p", value: js.get("bjerrum.LLi_rek.sN1N2.x", vars) + 0},
			{ name: "Isotachen", unit: "kPa", symbol: "σ'p", value: js.get("isotachen.LLi_e.sN1N2.x", vars) + 0},
			{ name: "Koppejan", unit: "kPa", symbol: "σ'p", value: js.get("koppejan.LLi_1.sN1N2.x", vars) + 0},
			{ name: "Rek bij Bjerrum/e", symbol: "εCv", unit: "%", value: js.get("bjerrum.LLi_e.sN1N2.y", vars) }, // TODO why not times 100 as well?
			{ name: "Rek bij Bjerrum/NEN", symbol: "εCv", unit: "%", value: js.get("bjerrum.LLi_rek.sN1N2.y", vars) * 100 },
			{ name: "Rek bij Isotachen", symbol: "εHv", unit: "%", value: js.get("isotachen.LLi_e.sN1N2.y", vars) * 100 },
			{ name: "Rek bij Koppejan", symbol: "εCv", unit: "%", value: js.get("koppejan.LLi_1.sN1N2.y", vars) / vars.Hi * 100 },
		]
	}, {
		name: "Poriëngetal",
		items: vars.stages.map((stage, i) => ({ name: js.sf("Trap %d", i + 1), symbol: "e(" + (i+1) + ")", value: stage.e0 })),
	}, {
		name: "Lineaire rek",
		items: vars.stages.map((stage, i) => ({ name: js.sf("Trap %d", i + 1), symbol: "EvC(" + (i+1) + ")", value: stage.EvC })),
	}, {
		name: "Natuurlijke rek",
		items: vars.stages.map((stage, i) => ({ name: js.sf("Trap %d", i + 1), symbol: "EvH(" + (i+1) + ")", value: stage.EvH })),
	}, {
		name: "Volumesamendrukkingscoëfficiënt",
		items: vars.stages.map((stage, i) => ({ name: js.sf("Trap %d-%d", i + 1, i + 2), unit: "1/Mpa", symbol: js.sf("mv%s(%s)", vars.temperature, i), value: stage.mv })).filter(_ => !isNaN(_.value))
	}, {
		name: "Casagrande - Consolidatie 50%",
		items: vars.stages.map((stage, i) => ({ name: js.sf("Trap %d", i + 1), unit: "s", symbol: "t50(" + (i+1) +")", value: stage.casagrande.t50[0] })),
	}, {
		name: "Casagrande - Consolidatie 100%",
		items: vars.stages.map((stage, i) => ({ name: js.sf("Trap %d", i + 1), unit: "s", symbol: "t100(" + (i+1) +")", value: stage.casagrande.t100[0] })),
	}, {
		name: "Casagrande - Consolidatiecoëfficiënt",
		items: vars.stages.map((stage, i) => ({ name: js.sf("Trap %d", i + 1), unit: "m2/s", symbol: js.sf("Cv%s(%s)", vars.temperature, (i + 1)), value: stage.casagrande.cv }))
	}, {
		name: "Casagrande - Waterdoorlatendheid",
		items: vars.stages.map((stage, i) => ({ 
				name: js.sf("Trap %d-%d", i + 1, i + 2), 
				unit: "m/s", symbol: js.sf("k%s(%s)", vars.temperature, i + 1), 
				value: stage.casagrande.k
			})).filter((o, i, a) => i < a.length - 1)
	}, {
		name: "Casagrande - Secundaire consolidatie (Calpha)",
		items: vars.stages.map((stage, i) => ({ name: js.sf("Trap %d", i + 1), symbol: "Cα(" + (i+1) + ")", unit: "-", value: stage.casagrande.Calpha }))
	}, {
		name: "Taylor - Consolidatie 50%",
		items: vars.stages.map((stage, i) => ({ name: js.sf("Trap %d", i + 1), unit: "s", symbol: "t50(" + (i+1) +")", value: stage.taylor.t50[0] })),
	}, {
		name: "Taylor - Consolidatie 90%",
		items: vars.stages.map((stage, i) => ({ name: js.sf("Trap %d", i + 1), unit: "s", symbol: "t90(" + (i+1) +")", value: stage.taylor.t90[0] })),
	}, {
		name: "Taylor - Consolidatiecoëfficiënt",
		items: vars.stages.map((stage, i) => ({ name: js.sf("Trap %d", i + 1), unit: "m2/s", symbol: js.sf("Cv%s(%s)", vars.temperature, i + 1), value: stage.taylor.cv }))
	}, {
		name: "Taylor - Waterdoorlatendheid",
		items: vars.stages.map((stage, i) => ({ 
			name: js.sf("Trap %d-%d", i + 1, i + 2), 
			unit: "m/s", symbol: js.sf("k%s(%s)", vars.temperature, i + 1), 
			value: stage.taylor.k
		})).filter((o, i, a) => i < a.length - 1)
	}, {
		name: "NEN/Bjerrum - Samendrukkingsindices",
		items: vars.stages.map((stage, i) => ({ 
			name: js.sf("Trap %d-%d", i + 1, i + 2), 
			symbol: js.sf("%s(%d-%d)", stage.Cc_, i + 1, i + 2), 
			value: stage.Cc })).filter((o, i, a) => i < a.length - 1).concat(bjerrum_e_variables(vars))
	}, {
		name: "NEN/Bjerrum - Samendrukkingsgetallen",
		items: vars.stages.map((stage, i) => ({ 
			name: js.sf("Trap %d-%d", i + 1, i + 2), 
			symbol: js.sf("%s(%d-%d)",  stage.CR_, i + 1, i + 2), 
			// symbol: js.sf("CR(%s)",  i), 
			value: stage.CR })).filter((o, i, a) => i < a.length - 1).concat(bjerrum_r_variables(vars))
	}, {
		name: "Isotachen - Samendrukkingscoëfficiënten",
		items: (() => {
			var Pg = vars.isotachen.LLi_e.sN1N2.x;
			var name, value;
			return vars.stages.slice(0, vars.stages.length - 1).map((stage, i) => {
				if(name === undefined) {
					name = "a";
				} else if(/*name === "b" &&*/ stage.target > vars.stages[i + 1].target) {
					name = "asw";
				} else if(name === "a" && stage.effective > Pg) {
					name = "b";
				} else if(name === "asw") {
					name = "ar";
				} else if(name === "ar") {
					name = "b";
				}

				value = stage.isotachen[name.charAt(0)];

				return {
					name: js.sf("%s-waarde %s Pg", name, (stage.target > Pg ? "boven" : "onder"), i + 1, i + 2),
					symbol: js.sf("%s(%d-%d)", name, i + 1, i + 2),
					value: value
				};
			}).concat(isotachen_variables(vars));
		})()
	}, {
		name: "Isotachen - c-waarde",
		items: vars.stages.slice(0, vars.stages.length - 1).map((stage, i) => ({
				name: js.sf("c-waarde Trap %d", i + 1),
				symbol: js.sf("c(%d)", i + 1),
				value: stage.isotachen.c
			}))
	}, {
		name: "Koppejan - Zetting (geëxtrapoleerde)",
		items: [
			{ name: "1 dag", unit: "mm", symbol: "ez1", value: vars.koppejan.serie2.map(o => o.ez1.toFixed(4)).join(" ") },
			{ name: "10 dagen", unit: "mm", symbol: "ez10", value: vars.koppejan.serie2.map(o => o.ez10.toFixed(4)).join(" ") },
			{ name: "100 dagen", unit: "mm", symbol: "ez100", value: vars.koppejan.serie2.map(o => o.ez100.toFixed(4)).join(" ") },
			{ name: "1000 dagen", unit: "mm", symbol: "ez1000", value: vars.koppejan.serie2.map(o => o.ez1000.toFixed(4)).join(" ") },
			{ name: "10000 dagen", unit: "mm", symbol: "ez10000", value: vars.koppejan.serie2.map(o => o.ez10000.toFixed(4)).join(" ") },
		]
	}, {
		name: "Koppejan - Parameters",
		items: (() => { 
			var Pg = vars.koppejan.LLi_1.sN1N2.x;
			var slopes = vars.koppejan.slopes;
			var serie2 = vars.koppejan.serie2;
			var sig = GDS.key_st;

			var unload = 0, pre, post, reload = 0;
			return slopes.map((o, index) => { 
				if(index === slopes.length - 1) return [];
				if(index && !unload) {
					// if((unload = serie2[index - 1][sig] > serie2[index][sig] ? 1 : 0)) {
					if((unload = serie2[index][sig] > serie2[index + 1][sig] ? 1 : 0)) {
						pre = "A";
					} else {
						pre = "C";
					}
				} else {
					if(unload) {
						reload++;
					}
					pre = "C";
				}

				post = serie2[index][sig] < Pg ? "" : "'";
				post += (reload === 1 ? "(r)" : "");

				return [
					{ name: js.sf("%s%s Trap %d-%d", pre, post, index + 1, index + 2), unit: "", symbol: js.sf("%s%s", pre, post), value: o.C },
					{ name: js.sf("%s10%s Trap %d-%d", pre, post, index + 1, index + 2), unit: "", symbol: js.sf("%s10%s", pre, post), value: o.C10 },
					{ name: js.sf("%sp%s Trap %d-%d", pre, post, index + 1, index + 2), unit: "", symbol: js.sf("%sp%s", pre, post), value: o.Cp },
					{ name: js.sf("%ss%s Trap %d-%d", pre, post, index + 1, index + 2), unit: "", symbol: js.sf("%ss%s", pre, post), value: o.Cs }
				];
			}).flat().concat(koppejan_variables(vars));
		})()
	}, {
		name: "Koppejan - Regressielijnen",
		items: vars.stages.map((stage, i) => {
			return { 
				name: js.sf("Richtingscoëfficiënt regressielijn %d", i + 1), 
				symbol: "rc" + (i + 1), 
				value: stage.koppejan.rc 
			};
		}).concat(
			vars.stages.map((stage, i) => ({ 
				name: js.sf("Nulpunt regressielijn %d", i + 1), 
				symbol: "np" + (i+1), 
				value: stage.koppejan.np 
			}))),
	}, {
		name: "Overig",
		items: [
			{ symbol: "m", name: "Initial Mass", unit: "-", value: vars.m },
			{ symbol: "md", name: "Initial Dry Mass", unit: "-", value: vars.md },
			{ symbol: "mf", name: "Final Mass", unit: "-", value: vars.mf },
			{ symbol: "mdf", name: "Final Dry Mass", unit: "-", value: vars.mdf },
		]
	}];
	vars.parameters = vars.categories.map(_ => (_.items||[]).map(kvp => js.mi({ category: _ }, kvp))).flat();
	var update = vars.parameters.update = () => {
		setup_parameters(root, vars, headerValue);
		GDS.setup_stages_2(vars);
		GDS.setup_variables_1(vars, vars.headerValue);
		root.udr("#array-variables").setArray(vars.headers.concat(vars.parameters));
		vars.parameters.update = update;
	};
/*-
	Effectieve belasting - σ'
	Belastingschema - σ'
	Poriëngetal - e
	Compression Index - Cc
	Compression Ratio - CR
	
	(Bjerrum/NEN)
		- Lineaire rek - εCv
	Coefficient of Consolidation 
		- Volumesamendrukkingscoëfficiënt - mv
		(Casagrande Method)
			- Tijd bij 50% consolidatie - t50
			- Consolidatiecoëfficient - cv
			- Waterdoorlatendheid - k
		(Taylor Method)
			- Tijd bij 90% consolidatie - t90
			- Consolidatiecoëfficient - cv
			- Waterdoorlatendheid - k
	(a,b,c-Isotachen)
		- Natuurlijke rek - εHv 
		- Natuurlijke Rek bij grenspanning NEN
		- Grenspanning bij NEN
		- a-waarden
		- b-waarden
		- c-waarden
	(Secundaire Consolidatieparameter Cα)
		- Secundaire Consolidatie Trap [...] - Calpha - Cα
	(Koppejan)
		- rc
		- np
		- z, z1, z10, z100, ...
		- Samendrukkingsparameters
			- Samendrukkingsconstant C > σ’p tussen Trap 5 en 6
*/
}

/* TODO refactor variables => parameters? */
function bjerrum_e_variables(vars) {
	var onder = js.get("overrides.bjerrum_e.label-onder", vars) || "1-2";
	var boven = js.get("overrides.bjerrum_e.label-boven", vars) || "3-4";
	
	var o = js.get("overrides.bjerrum_e.onder", vars) || "nog te bepalen";
	var b = js.get("overrides.bjerrum_e.boven", vars) || "nog te bepalen";

	return [
		{ name: js.sf("Trap %s", onder), unit: "", symbol: js.sf("Cc(%s)", onder), value: o },
		{ name: js.sf("Trap %s", boven), unit: "", symbol: js.sf("Cr(%s)", boven), value: o },
	];
	
}
function bjerrum_r_variables(vars) {
	var onder = js.get("overrides.bjerrum_r.label-onder", vars) || "1-2";
	var boven = js.get("overrides.bjerrum_r.label-boven", vars) || "3-4";
	
	var o = js.get("overrides.bjerrum_r.onder", vars) || "nog te bepalen";
	var b = js.get("overrides.bjerrum_r.boven", vars) || "nog te bepalen";

	return [
		{ name: js.sf("Trap %s", onder), unit: "", symbol: js.sf("CR(%s)", onder), value: o },
		{ name: js.sf("Trap %s", boven), unit: "", symbol: js.sf("RR(%s)", boven), value: o },
	];
	
}
function isotachen_variables(vars) {
	var onder = js.get("overrides.isotachen.label-onder", vars) || "1-2";
	var boven = js.get("overrides.isotachen.label-boven", vars) || "3-4";
	
	var o = js.get("overrides.isotachen.onder", vars) || "nog te bepalen";
	var b = js.get("overrides.isotachen.boven", vars) || "nog te bepalen";

	return [
		{ name: "a onder pg", unit: "", symbol: js.sf("a(%s)", onder), value: o },
		{ name: "b boven pg", unit: "", symbol: js.sf("b(%s)", boven), value: o }
	];
}
function koppejan_variables(vars) {
	var onder = js.get("overrides.koppejan.label-onder", vars) || "1-2";
	var boven = js.get("overrides.koppejan.label-boven", vars) || "3-4";
	
	var o = js.get("overrides.koppejan.onder", vars) || "nog te bepalen";
	var b = js.get("overrides.koppejan.boven", vars) || "nog te bepalen";

	return [
		{ name: js.sf("C Trap %s", onder), unit: "", symbol: onder, value: o.C },
		{ name: js.sf("C10 Trap %s", onder), unit: "", symbol: onder, value: o.C10 },
		{ name: js.sf("Cp Trap %s", onder), unit: "", symbol: onder, value: o.Cp },
		{ name: js.sf("Cs Trap %s", onder), unit: "", symbol: onder, value: o.Cs },
		{ name: js.sf("C' Trap %s", boven), unit: "", symbol: boven, value: o.C },
		{ name: js.sf("C10' Trap %s", boven), unit: "", symbol: boven, value: o.C10 },
		{ name: js.sf("Cp' Trap %s", boven), unit: "", symbol: boven, value: o.Cp },
		{ name: js.sf("Cs' Trap %s", boven), unit: "", symbol: boven, value: o.Cs }
	];
}

function TrendLineEditor_stop_BI(vars, stage, chart, owner) {
	var modified = false, points = [];
	var name = owner._name.substring("graph_".length).toLowerCase();
	if(["bjerrum_e", "bjerrum_r", "isotachen"].indexOf(name) !== -1) {
		chart.trendLines.filter(tl => tl.editable).forEach((tl, index) => {
			if(tl) {
				modified = true;
				tl.lineThickness = 1;
				tl.draw();
				points.push(
					{ x: tl.initialXValue, y: tl.initialValue },
					{ x: tl.finalXValue, y: tl.finalValue });
			}
		});
		js.set(js.sf("overrides.%s.points_pg", name), points, vars);
		if(modified) {
			stage.update(name); // FIXME stage(0).updates
		}
	}
	return modified === true;
}

["", { 
	handlers: handlers, 
	vars: { 
		layout: "grafieken/documenten/Samendrukkingsproef",
		graphs: [
			"Casagrande", 
			"Taylor", 
			"Bjerrum_e", 
			"Bjerrum_r", 
			"Isotachen", 
			"Koppejan", 
			"Isotachen_c"
		],
		setup() {
			const vars = this.vars(["variables"]);
			
			((setup_settlement) => {
				let adm = this.udr("#allow-disabling-measurements");
				adm.vars("visible", false);
				adm.toggle("visible"); adm.toggle("visible");
			})();
			
			setup_casagrande(vars);
			setup_taylor(vars);
			setup_bjerrum(vars);
			setup_isotachen(vars);
			setup_koppejan(vars);
			setup_stages_2(vars);
			setup_parameters(this, vars, vars.headerValue);
		}
	}
}, [
    [("#reflect-overrides"), {
    	on(evt) {
    		var vars = this.vars(["variables"]);
    		if(evt.overrides) {
    			vars.overrides = evt.overrides;
    		} else {
    			if(!vars.overrides) return;
    			delete vars.overrides;
    		}
			vars.stages.forEach(stage => stage.update("all"));
			vars.koppejan.update();
			vars.parameters.update();
			this.ud("#graphs").getControls().map(c => c.render());
    	}
    }],
    [("#options"), [
        ["vcl/ui/Group", ("group_title"), {}, [
            ["vcl/ui/Element", {
                classes: "header",
                content: "Titel"
            }],
            ["vcl/ui/Input", "option_title", {
                // placeholder: "schaal 1:{schaal}"
            }]
        ]],
        ["vcl/ui/Group", ("group_description"), {}, [
            ["vcl/ui/Element", {
                classes: "header",
                content: "Opmerking"
            }],
            ["vcl/ui/Input", "option_description", {
                value: "geen"
            }]
        ]],
        ["vcl/ui/Group", ("group_buttons"), {
            css: "padding-top:8px;"
        }, [
            ["vcl/ui/Button", ("button_generate"), {
                action: "#generate", // will be resolved by code in Tabs<Document>
                content: "Genereren..."
            }]
        ]],
        ["vcl/ui/Group", { classes: "seperator" }],
        ["vcl/ui/Group", ("group_state"), {}, [
            ["vcl/ui/Element", {
                classes: "header",
                content: "Staat van het monster"
            }],
            ["vcl/ui/Input", "option_state", {
                value: "Ongeroerd"
            }]
        ]],
        ["vcl/ui/Group", ("group_preparation"), {}, [
            ["vcl/ui/Element", {
                classes: "header",
                content: "Preparatiemethode",
            }],
            ["vcl/ui/Input", "option_preparation", {
                placeholder: "",
                value: "Overgeschoven"
            }]
        ]],
        ["vcl/ui/Group", { classes: "seperator" }],
   //     ["vcl/ui/Group", ("group_layout"), {}, [
			// ["vcl/ui/Element", {
			// 	classes: "header",
			// 	content: "Opmaak"
			// }],
			// ["vcl/ui/Select", ("option_layout"), {
			// 	options: [
			// 		{ value: "2", content: "Standaard" },
			// 	],
			// 	value: "2"
			// }]
   //     ]],
   //     ["vcl/ui/Group", ("group_orientation"), {}, [
   //         ["vcl/ui/Element", {
   //             classes: "header",
   //             content: "Orientatie"
   //         }],
   //         ["vcl/ui/Select", "orientation", {
   //             // enabled: false,
   //             options: ["Staand (A4)"]
   //         }]
   //     ]],
   //     ["vcl/ui/Group", ("group_locale"), {}, [
   //         ["vcl/ui/Element", {
   //             classes: "header",
   //             content: "Taal"
   //         }],
   //         ["vcl/ui/Select", "locale", {
   //             options: [{
   //                 value: "nl_NL",
   //                 content: "Nederlands (NL)"
   //             // },
   //             // {
   //             //     value: "en_UK",
   //             //     content: "English (UK)"
   //             }]
   //         }]
   //     ]],
   //     ["vcl/ui/Group", { classes: "seperator" }],
        ["vcl/ui/Group", ("group_options"), {}, [
            ["vcl/ui/Group", [
	            ["vcl/ui/Checkbox", "option_footer", {
	            	classes: "block",
	            	label: "Voettekst weergeven",
	            	checked: true,
	            	// onChange: Handlers['option_footer.onChange']
	            }],
	            ["vcl/ui/Checkbox", "option_logo", {
	            	classes: "block",
	            	label: "Logo weergeven",
	            	checked: true, visible: false
	            }]
			]]
		]]
    ]],
	[("#tabs-graphs"), [
		["vcl/ui/Tab", { text: "Casagrande", control: "graph_Casagrande", selected: true, vars: { multiple: true } }],
		["vcl/ui/Tab", { text: "Taylor", control: "graph_Taylor", selected: !true, vars: { multiple: true } }],
		["vcl/ui/Tab", { text: "Isotachen (c)", control: "graph_Isotachen_c", selected: !true, vars: { multiple: true } }],
		["vcl/ui/Tab", { text: "Bjerrum (poriëngetal)", control: "graph_Bjerrum_e", selected: !true }],
		["vcl/ui/Tab", { text: "Bjerrum (rek)", control: "graph_Bjerrum_r", selected: !true }],
		["vcl/ui/Tab", { text: "Isotachen", control: "graph_Isotachen", selected: !true }],
		["vcl/ui/Tab", { text: "Koppejan", control: "graph_Koppejan", selected: !true }],
		["vcl/ui/Bar", ("menubar"), {
			align: "right", autoSize: "both", classes: "nested-in-tabs"
		}, [
			["vcl/ui/Button", ("button-edit-graph"), { 
				action: "toggle-edit-graph",
				classes: "_right", content: "Lijnen muteren"
			}],
			["vcl/ui/PopupButton", ("button-edit-graph-stage"), { 
				action: "edit-graph-stage", classes: "_right", origin: "bottom-right",
				content: "Lijnen muteren <i class='fa fa-chevron-down'></i>",
				popup: "popup-edit-graph-stage"
			}]	
		]]
	]],
	[("#graphs"), { }, [
		["vcl/ui/Panel", ("graph_Casagrande"), {
			align: "client", visible: false, classes: "multiple",
			vars: {
				TrendLineEditor_stop(vars, stage, chart, owner) {
					var modified;
					chart.trendLines.forEach((tl, index) => {
						var type = index === 0 ? "AB" : "DEF";
						if(tl && tl.modified) {
							modified = true;
							tl.lineThickness = 1;
							tl.draw();
				
							var line = {
								initialXValue: tl.initialXValue,
								initialValue: tl.initialValue,
								finalXValue: tl.finalXValue,
								finalValue: tl.finalValue
							};
					
							js.set(js.sf("overrides.casagrande.stage%d.lines.%s", stage.i, type), line, vars);
						}
					});
					if(modified) {
						stage.casagrande.update();
					}
					return modified === true;
				}
			}
		}],
		["vcl/ui/Panel", ("graph_Taylor"), {
			align: "client", visible: false, classes: "multiple",
			vars: {
				TrendLineEditor_stop(vars, stage, chart, owner) {
					var modified;
					chart.trendLines.forEach((tl, index) => {
						var type = "Qq"; // lineaire fit
						if(tl && tl.modified) {
							modified = true;
							tl.lineThickness = 1;
							tl.draw();
				
							var line = {
								initialXValue: tl.initialXValue,
								initialValue: tl.initialValue,
								finalXValue: tl.finalXValue,
								finalValue: tl.finalValue 
							};
					
							js.set(js.sf("overrides.taylor.stage%d.lines.%s", stage.i, type), line, vars);
						}
					});
					if(modified) {
						stage.taylor.update();
					}
					return modified === true;
				}
			}
		}],
		["vcl/ui/Panel", ("graph_Bjerrum_e"), {
			align: "client", visible: false,
			vars: { TrendLineEditor_stop: TrendLineEditor_stop_BI }
		}],
		["vcl/ui/Panel", ("graph_Bjerrum_r"), {
			align: "client", visible: false,
			vars: { TrendLineEditor_stop: TrendLineEditor_stop_BI }
		}],
		["vcl/ui/Panel", ("graph_Isotachen"), {
			align: "client", visible: false,
			vars: { TrendLineEditor_stop: TrendLineEditor_stop_BI }
		}],
		["vcl/ui/Panel", ("graph_Koppejan"), {
			align: "client", visible: false,
			vars: {
				TrendLineEditor_stop(vars, stage, chart, owner) {
					var modified = false, points = [];
					chart.trendLines.filter(tl => tl.editable).forEach((tl, index) => {
						if(tl) {
							modified = true;
							tl.lineThickness = 1;
							tl.draw();
							points.push(
								{ x: tl.initialXValue, y: tl.initialValue },
								{ x: tl.finalXValue, y: tl.finalValue });
						}
					});
					js.set("overrides.koppejan.points_pg", points, vars);
					vars.koppejan.update();
					return modified === true;
				}
			}
		}],
		["vcl/ui/Panel", ("graph_Isotachen_c"), {
			align: "client", visible: false, classes: "multiple",
			vars: {
				TrendLineEditor_stop(vars, stage, chart, owner) {
					var modified;
					chart.trendLines.forEach((tl, index) => {
						var type = "DEF";
						if(tl && tl.modified) {
							modified = true;
							tl.lineThickness = 1;
							tl.draw();
				
							var line = {
								initialXValue: tl.initialXValue,
								initialValue: tl.initialValue,
								finalXValue: tl.finalXValue,
								finalValue: tl.finalValue
							};
					
							js.set(js.sf("overrides.isotachen.stage%d.lines.%s", stage.i, type), line, vars);
						}
					});
					if(modified) {
						stage.isotachen.update();
					}
					return modified === true;
				}
			}
		}],
		
		[("#panel-edit-graph"), {}, [
			["vcl/ui/Element", { element: "span", content: "onder Pg:"}],
			["vcl/ui/Input", "label-onder", { placeholder: "#-#"}],
			["vcl/ui/Element", { element: "span", content: "boven Pg:"}],
			["vcl/ui/Input", "label-boven", { placeholder: "#-#"}],
		]]
	]]
]];