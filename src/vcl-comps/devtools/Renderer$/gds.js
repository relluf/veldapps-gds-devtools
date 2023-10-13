"use ./Util, locale!./locales/nl, vcl/ui/Button, vcl/ui/Tab, papaparse/papaparse, amcharts, amcharts.serial, amcharts.xy, lib/node_modules/regression/dist/regression, ";

define("devtools/Renderer<gds>.parseValue", () => (value) => isNaN(value.replace(",", ".")) ? value : parseFloat(value.replace(",", ".")));

/*-
	* `#VA-20201218-3` Main issue
	* `#VA-20210816-1` Deduce/copy Axial Stress from Stress Target
	* `#VA-20230130-1` 
		- Adding traxial variant
		- Refactoring into two components
			- Renderer<gds.settlement>
			- Renderer<gds.triaxial>
	
	- "entry point": vcl/Action#refresh.on
*/

const js = require("js");
const Util = require("./Util");

const Button = require("vcl/ui/Button");
const Tab = require("vcl/ui/Tab");
const Control = require("vcl/Control");

/* Some styles and class */
const css = {
		"a": "visibility:hidden;",
		">:not(.multiple) > div": "height: 100%;",
		">.multiple > div": "width:48%;height:48%;display:inline-block;" + 
			"border: 1px dashed black;" +
			"margin-left:1%;margin-right:1%;margin-top:5px;margin-bottom:5px;" + 
			"min-width:300px;min-height:300px;",
		// "> :not(.multiple)": "margin:5px;",
		"&.pdf > :not(.multiple)": "margin:5px;width: 850px; height: 470px; background-color: rgba(56, 121, 217, 0.075); border: 3px dashed rgb(56, 121, 217);",
		"&.pdf.generate .multiple > div": "height: 470px; width:850px; position:absolute;top:0;left:0;",
		"&.pdf .multiple > div.selected": "background-color: rgba(56, 121, 217, 0.075); border: 3px dashed rgb(56, 121, 217);",
		"div.selected": "background-color: rgba(56, 121, 217, 0.075); border: 3px dashed rgb(56, 121, 217);",
		"div.editing": "background-color: #f0f0f0; border: 3px dashed orange;top:0;left:0;right:0;bottom:0;z-index:1;position:absolute;width:auto;height:auto;margin:5px;",
		// ".amcharts-main-div": "border: 3px solid transparent;"
	};

/* Event Handlers */
const handlers = {
	/* Event Handlers */
	"loaded": function root_loaded() {
		var editor, me = this, root = this.up("devtools/Editor<vcl>");
		if(root) {
			/*- DEBUG: hook into the 1st Editor<gds> we can find (if any) in order to tweak/fiddle code */
			if((editor = root.app().down("devtools/Editor<gds>:root"))) {
				var previous_owner = me._owner;
				me.setOwner(editor);
				me.on("destroy", () => me.setOwner(previous_owner));
			}
	 	}
	 	
	 	logger = this;
	}
};

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

var logger; 

["", { handlers: handlers }, [
	
    ["vcl/Action", ("modified"), {
    	state: false,
    	visible: "state"
    }],
    ["vcl/Action", ("editing"), {
    	state: false,
    	selected: "state"
    }],
    ["vcl/Action", ("refresh"), {
		on() {
			var Parser = require("papaparse/papaparse");
			var options = this.vars(["options"]) || {
				// delimiter: "",	// auto-detect
				// newline: "",	// auto-detect
				// quoteChar: '"',
				// escapeChar: '"',
				// header: false,
				// dynamicTyping: false,
				// preview: 0,
				// encoding: "",
				// worker: false,
				// comments: false,
				// step: undefined,
				// complete: undefined,
				// error: undefined,
				// download: false,
				// skipEmptyLines: false,
				// chunk: undefined,
				// fastMode: undefined,
				// beforeFirstChunk: undefined,
				// withCredentials: undefined
			};
			var vars = this.up().vars("variables", {});
			var headerValue = (key, parse/*default true*/) => {
				key = key.toLowerCase();
				key = (vars.headers.filter(_ => _.name.toLowerCase().startsWith(key))[0] || {});
				return parse === false ? key.raw : key.value;
			};
		
		/*- parse lines => headers, columns and measurements */		
			var ace = this.udr("#ace");
			var lines = ace.getLines().filter(_ => _.length); if(lines.length < 2) return; //can't be good
			var headers = lines.filter(_ => _.split("\"").length < 15);
			var measurements = lines.filter(_ => _.split("\"").length > 15);
	
		/*- parse columns */
			vars.columns = measurements.shift().split(",").map(Util.removeQuotes);
			vars.headerValue = headerValue;
		
		/*- parse headers */	
			vars.headers = headers.map(_ => _.split("\",\"")).filter(_ => _.length === 2)
				.map(_ => [Util.removeTrailingColon(_[0].substring(1)), _[1].substring(0, _[1].length - 2)])
				.map(_ => ({category: "Header", name: _[0], value: Util.parseValue(_[1]), raw: _[1]}));
			
		/*- use overrides immediately (if any) */	
			vars.overrides = this.vars(["overrides"]);
		
		/*- setup dataset and variables */
			Util.setup_measurements_1(vars, Parser.parse(measurements.join("\n"), options).data);
			Util.setup_variables_1(vars, headerValue);
			Util.setup_measurements_2(vars);
			Util.setup_stages_1(vars);
			
			this.applyVar("setup", [], true); // no args, fallback to owner
			
			this.udr("#array-measurements").setArray(vars.measurements);
			this.udr("#array-variables").setArray(vars.headers.concat(vars.parameters));
	
			if(!vars.parameters.update) {
				var update = (vars.parameters.update = () => {
					Util.setup_stages_2(vars);
					Util.setup_variables_1(vars, vars.headerValue);
					this.udr("#array-variables").setArray(vars.headers.concat(vars.parameters));
					vars.parameters.update = update;
				});
			} else {
			}
			
			var edit = this.udr("#edit-graph-stage"), popup = this.udr("#popup-edit-graph-stage");
			popup.destroyControls();
			vars.stages.forEach((stage, index) => {
				new Button({
					action: edit, parent: popup,
					content: js.sf("Trap %d", index + 1), 
					selected: "never", vars: { stage: index }
				});
			});
			
			this.ud("#graphs").getControls().forEach(c => c.setState("invalidated", true));
			this.print("parsed", { stages: vars.stages, variables: vars, measurements: vars.measurements });
		}
    }],

    ["vcl/Action", ("toggle-edit-graph"), {
    	selected: "state",
    	state: false, 
    	visible: false,
    	on(evt) {
			var vars = this.vars(["variables"]), am, node, chart;
    		var graph = this.ud("#graphs > :visible"), state;
    		var stage = evt && evt.component.vars("stage");

    		am = (evt && evt.am) || graph.getNode().down(".amcharts-main-div");
			if(stage === undefined) {
				stage = Array.from(am.parentNode.parentNode.childNodes).indexOf(am.parentNode);
			}
			
			/* get the stage being clicked */
			chart = (graph.vars("am-" + stage) || graph.vars("am")).chart;

			if(!(state = this.toggleState())) {
				vars.editor && vars.editor.stop(true);
				delete vars.editor;
				this.ud("#popup-edit-graph-stage")._controls.forEach(c => c.setSelected("never"));
				// stage = undefined;
			} else {
				vars.editor = new TrendLineEditor(vars, vars.stages[stage], chart, graph);
				node = graph.getNode();
				node.previous_scrollTop = node.scrollTop;
				node.scrollTop = 0;
				graph._parent.focus();
	
				// if(evt && !evt.am && stage !== undefined) {
					// evt.component.print("nevering", evt);
					// evt.component._parent._controls.forEach(c => c.setSelected(c === evt.component ? true : "never"));
				// }
				
				if(stage !== undefined) {
					this.ud("#popup-edit-graph-stage").getControls().forEach((c, i) => c.setSelected(i === stage ? true : "never"));
				}
			}
			
			var multiple = getSelectedGraph(this).multiple;
			this.ud("#panel-edit-graph").setVisible(this.getState() && !multiple);
    	}
    }],
    ["vcl/Action", ("edit-graph-stage"), {
    	selected: "parent",
    	state: "parent",
    	parent: "toggle-edit-graph",
    	// parentExecute: true,
    	on(evt) {
    		// if(this.isSelected()) {
    		// 	this._parent.execute();
    		// }
    		if(evt.component.hasVar("stage")) {
    			// if it is a button inside the popup
    			if(this.isSelected() && !evt.component.isSelected()) {
    				this._parent.execute(); // deselect first
    			}
    			this._parent.execute(evt);
    		}
    	}
    }],
    
    ["vcl/Action", ("persist-changes"), {
    	parent: "modified",
    	visible: "parent",
    	on() {
    		/* overridden in eg. Tabs<Document> */
    		alert("LET OP: Niet geimplementeerd!");
    	}
    }],
    ["vcl/Action", ("cancel-changes"), {
    	parent: "modified",
    	visible: "parent",
    	on() {
			if(confirm("LET OP: Alle wijzigingen zullen verloren gaan.\n\nWeet u zeker dat u wilt annuleren?")) {
				// this.ud("#editing").setState(false);
				this.ud("#toggle-edit-graph").execute();
				this.ud("#modified").setState(false);
				this.ud("#refresh").execute();
			}
    	}
    }],
    ["vcl/Action", ("reflect-overrides"), {}],

    ["vcl/ui/Popup", ("popup-edit-graph-stage"), { 
    	autoPosition: false,
		classes: "mw",
		css: {
			".{Button}": "white-space: nowrap;",
			"&.mw.mw.mw": "right:0;max-width:200px;",
			"span": "font-size:smaller;"
		}
    }],

	["vcl/ui/Group", ("options"), { visible: false }],
	
	["vcl/ui/Tabs", ("tabs-graphs"), {}, []],
	["vcl/ui/Panel", ("graphs"), { 
		align: "client", css: css, tabIndex: 1
	}, [
		["vcl/ui/Panel", ("panel-edit-graph"), {
			align: "top", autoSize: "height", groupIndex: 1,
			css: {
				"": "padding:8px;text-align:center;",
				">*": "margin-right: 4px;" ,
				"input": "text-align:center;width:40px;border-radius: 5px; border-width: 1px; border-color: rgb(240, 240, 240); padding: 2px 4px;"
		    },
			visible: false
		}]
	]]
]];