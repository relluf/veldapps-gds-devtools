"use papaparse/papaparse, amcharts, amcharts.serial, amcharts.xy";

const Parser = require("papaparse/papaparse");

const gdsKey = (name, obj) => {
	if(obj.hasOwnProperty(name)) return name;
	return Object.keys(obj).filter(k => k.startsWith(name))[0];
};
const guess = (lines) => {
	
	lines = lines.filter(_ => _.length);
	
	if(lines.length < 2) return null;
	
	var headers = lines.filter(_ => _.split("\"").length < 15);
	var measurements = lines.filter(_ => _.split("\"").length > 15);

	if(headers.length >= 22 && headers.length <= 23) {
		return "settlement";
	}
	
	return "triaxial";
};
const match = (obj, q) => {
	q = q.toLowerCase();	
	if(typeof obj ==="string") {
		return obj.toLowerCase().includes(q);
	}
	for(var k in obj) {
		if(js.sf("%n", obj[k]).toLowerCase().includes(q)) {
			return true;
		}
	}
	return false;
};
const css = {
	"#bar": "text-align: center;",
	"#bar > *": "margin-right:5px;",
	"#bar input": "font-size:12pt;width:300px;max-width:50%; border-radius: 5px; border-width: 1px; padding: 2px 4px; border-color: #f0f0f0;",
	"#bar #left": "float:left;", "#bar #right": "float:right;",
	"#bar .button": {
		'': "float: right; margin: 2px; padding: 2px 4px; border-radius: 3px;",
		'&.left': "float:left;",
		'&:hover': "background-color: #f0f0f0; cursor: pointer;",
		'&:active': "color: rgb(56, 121, 217);",
		'&.selected': "background-color: rgb(56, 121, 217); color: white;",
		'&.disabled': "color: silver;"
	}
};
const handlers = {
	"#tabs-sections onChange"(newTab, curTab) {
		var visible = newTab && (newTab.vars("bar-hidden") !== true);

		this.ud("#bar").setVisible(visible);
		var adm = this.ud("#allow-disabling-measurements");
		adm.setVisible(adm.vars("visible") !== false && newTab._name === "tab-measurements");
		
		curTab && curTab.vars("q", this.ud("#q").getValue());
		visible && this.setTimeout("update-q", () => {
			let q = this.ud("#q"), v = newTab.vars("q") || "";
			if(q.getValue() !== v) {
				q.setValue(v);
			}
		}, 50);
	},
	"#tabs-sections onDblClick"() {
		this.udr("#menubar").dispatch("dblclick", {});
	}
};

const escape = (s) => js.sf("\"%s\"", ("" + s).replace(/"/g, "\\\""));
const downloadCSV = (arr, filename) => {
	const headers = Object.keys(arr[0]);
	const data = [headers.map(s => escape(s))].concat(arr.map(o => headers.map(h => escape(o[h]))));
	const csv = data.map(row => row.join(',')).join('\n');
	const blob = new Blob([csv], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
};

["", { css: css, handlers: handlers }, [
    [("#ace"), { 
    	align: "left", width: 475, 
    	action: "toggle-source",
    	executesAction: "none",
        onChange() {
        	this.setTimeout("render", () => {

        		var renderer = this.ud("#renderer");

        		const owner = this._owner;
        		const lines = this.getLines();
        		const refresh = () => {
	        		if(this.getLines().length) {
	        			renderer.qs("#refresh").execute();
						this.up("vcl/ui/Tab").emit("resource-rendered", [{sender: this, }]);
						// TODO emiting that event from here is just weird
	        		}
        		};
        		
        		if(renderer === null) { // dynamically determine actual Renderer<>
        			var type = guess(lines);
        			if(type === null) {
        				throw new Error("Unknown GDS type");
        			}
        			
        			B.i([js.sf("vcl-comps:devtools/Renderer<gds.%s>", type), "renderer"])
        				.then(r => {
        					renderer = r;
        					
        					r.addClass("gds-" + type);
        					r.setParent(this.ud("#container-renderer"));
        					r.setOwner(owner);
        					r.qs("#panel-edit-graph").bringToFront();

							r.print("instantiated", r);
        					
        					refresh();
        				});
        		} else {
        			refresh();
        		}
        		
        	}, 750);
        }
    }],

    ["vcl/Action", ("toggle-source"), {
        hotkey: "Shift+MetaCtrl+S",
        selected: "state", visible: "state", 
        state: true,
        onLoad() {
    		this.up().readStorage("source-visible", (visible) => {
    			if(typeof visible === "boolean") {
    				this.setState(visible);
    			} else if(visible === undefined && this.vars(["resource.uri"]).split("/").pop() === ".md") {
    				this.setState(false);
    			}
    		});
        },
        onExecute() {
        	var state = !this.getState();
        	this.setState(state);
        	this.up().writeStorage("source-visible", state);
        	if(!state) {
        		
        	}
        }
    }],

    ["vcl/Action", ("allow-disabling-measurements"), {
    	visible: false
    }],
    ["vcl/Action", ("toggle-show-measurement-enabled"), {
    	content: "<i class='fa fa-check-circle'></i> aan", state: true, selected: "state",
    	parent: "allow-disabling-measurements",
    	visible: "parent",
    	on() { 
    		let q = this.ud("#q"); this.toggleState(); 
    		q.removeVar("previous");
    		q.fire("onChange"); 
    	}
    }],
    ["vcl/Action", ("toggle-show-measurement-disabled"), {
    	content: "<i class='fa fa-times-circle'></i> uit", state: true, selected: "state",
    	parent: "allow-disabling-measurements",
    	visible: "parent",
    	on() { 
    		let q = this.ud("#q"); this.toggleState(); 
    		q.removeVar("previous");
    		q.fire("onChange"); 
    	}
    }],
    ["vcl/Action", ("toggle-set-measurement-disabled"), {
    	enabled: false, content: "<i class='fa fa-toggle-on'></i> aan/uit schakelen",
    	parent: "allow-disabling-measurements",
    	visible: "parent",
    	on() {
    		let list = this.ud("#measurements");
    		let sel = list.getSelection(true);
    		sel.forEach(elem => {
    			if(elem.hasOwnProperty("disabled")) {
    				delete elem.disabled;
    			} else {
    				elem.disabled = true;
    			}
    		});
    		
    		let q = this.ud("#q"); q.removeVar("previous");
    		q.fire("onChange");
    		
    		list._body._controls.forEach(r => r.setState("classesInvalidated")); // hacker-de-hack
    		list.render_(true);
    		
    		this.ud("#graphs")._controls.map(c => c.render());
    		
    		let objs = list.getSource().getObjects()
    			.map((obj, index) => [index, obj.disabled])
    			.filter(arr => arr[1] === true)
    			.map(arr => arr[0]);
    			
    		let variables = this.vars(["variables"]);
    		js.set("overrides.measurements-disabled", objs, variables);
    		this.udr("#modified").setState(true);
    	}
    }],

	["vcl/data/Array", ("array-measurements"), {
		onLoad() {
			var gan = this.getAttributeNames;
			//L/C Pressure (kPa),L/C Volume (mm�),Local Axial 1 (mm),Local Axial 2 (mm),Local Radial (mm),Base Pressure (kPa),Base Volume (mm�),Back Differential Pressure (kPa),Axial Displacement 2 (mm),Pore Air Pressure (kPa),Pore Air Volume (mm�),Atmospheric Pressure (kPa),Temperature (�C),Mid Plane PWP (kPa),Back to Cell Differential (kPa),Total Volume Change (mm�),Undefined Tx 1,Undefined Tx 2,Undefined Tx 3,Current Area (mm�),Lower Chamber Displacement (mm),Lower Chamber Axial Load (kN),Specimen Air Volume (mm�),Matric Suction (kPa),Voids ratio,Degree of Saturation (%),Specimen Water Volume (mm�),kRT constant ,
			//this.override("getAttributeNames", () => "Stage Number,Time since start of test (s),Time since start of stage (s),Radial Pressure (kPa),Radial Volume (mm�),Back Pressure (kPa),Back Volume (mm�),Load Cell (kN),Pore Pressure (kPa),Axial Displacement (mm),Axial Force (kN),Axial Strain (%),Av Diameter Change (mm),Radial Strain (%),Axial Stress (kPa),Eff. Axial Stress (kPa),Eff. Radial Stress (kPa),Deviator Stress (kPa),Total Stress Ratio (%),Eff. Stress Ratio (%),Shear Strain (%),Cambridge p (kPa),Eff. Cambridge p' (kPa),Max Shear Stress t (kPa),Volume Change ;(mm�),B Value,Mean Stress s/Eff. Axial Stress 2,Excess PWP (kPa),PWP Ratio,stage,seconds,minutes,hours,days,secondsT,daysT,z,minutes_sqrt,minutes_log10,days_log10,EvC,EvH,x,y_taylor,y,ROS,txVC,txPWPR,txDS,txWO,txEHSR,txEHSR_clipped,txSS,txSS_2".split(","));
		},
		onGetAttributeValue: function(name, index, value) { 
			return (this._arr[index] || {})[name]; 
		},
		onFilterObject(obj, index, context) {
			if(!context.states) {
				context.states = {
					disabled: this.ud("#toggle-show-measurement-disabled").getState(),
					enabled: this.ud("#toggle-show-measurement-enabled").getState()
				}
			}
			
			if((!context.states.disabled && obj.disabled) || (!context.states.enabled && obj.disabled === undefined)) {
				return true;
			}
			
			var q = this.vars("q");
			if(!q) return false;
			
			var parts = q.split(/(?<!\\)\s/).map(
					s => s.split(/(?<!\\)\=/).map(s => String.unescape(s)));
			
			while(parts.length) {
				var part = parts.pop();
				if(part.length === 2) {
					var k = gdsKey(part[0], obj), v = part[1].trim().toLowerCase();
					if(obj.hasOwnProperty(k) && js.sf("%s", obj[k]).toLowerCase().indexOf(v) !== -1) {
						return false;
					}
				} else {
					return !match(obj, part[0]);
				}
			}
			
			return true;//!parts.length ? false : !match(obj, parts[0]);
		}
	}],
	["vcl/data/Array", ("array-variables"), {
		onFilterObject(obj) {
			var q = this.vars("q");
			if(!q) return false;
			return q.split(/\s/).filter(q => q.length > 0).some(q => !match(obj, q));
		}
	}],

	["vcl/ui/Tabs", ("tabs-sections"), { classes: "bottom", align: "bottom" }, [
		["vcl/ui/Tab", "tab-variables", { text: "Variabelen", control: "variables", selected: !true }],
		["vcl/ui/Tab", "tab-measurements", { text: "Metingen", control: "measurements" }],
		["vcl/ui/Tab", "tab-graphs", { text: "Grafieken", control: "container-renderer", selected: true, vars: { 'bar-hidden': true }} ],
	]],
	["vcl/ui/Bar", ("bar"), { visible: false }, [
		["vcl/ui/Element", ("csv"), {
			classes: "button",
			content: "<i class='fa fa-download'></i>",
			onTap() {
				// const arr = this.udr("#array-variables").getArray();
				const tab = this.ud("#tabs-sections").getSelectedControl(1);
				const list = tab.getControl();

				if(list instanceof req("vcl/ui/List")) {
					const arr = list.getSource();
					const name = arr.getName().split("-").pop();
					
					downloadCSV(arr.getArray(), name + ".csv");
				}
			}
		}],
		["vcl/ui/Element", ("toggle-measurement-disabled"), {
			action: "toggle-set-measurement-disabled",
			classes: "button left"
		}],
		["vcl/ui/Element", ("show-measurement-enabled"), {
			classes: "button",
			action: "toggle-show-measurement-enabled"
		}],
		["vcl/ui/Element", ("show-measurement-disabled"), {
			classes: "button",
			action: "toggle-show-measurement-disabled"
		}],
		["vcl/ui/Input", ("q"), { 
			placeholder: "Filter", 
			onChange() { 
				this.setTimeout("updateFilter", () => {
					let value = this.getValue(), attrs;
					
					if(value.startsWith("|")) {
						attrs = value.split(/(?<!\\)\|/);
						value = attrs.pop();
					}
					

					let previous = this.vars("previous");
					if(previous && previous.value === value) {
						return;
					}
					
					this.vars("previous", { name: value, value: value, time: Date.now() });

					let a1 = this.udr("#array-variables"), a2 = this.ud("#array-measurements");
					a1.vars("q", value);
					a1.updateFilter();

					let measurements = this.ud("#measurements");
					if(measurements.isVisible()) {
			    		measurements._controls.forEach(r => r.setState("classesInvalidated", true));
						measurements._columns.map(
							column => column.setVisible(
								!attrs || attrs.filter(a => a).some(a => column._attribute.includes(a))
							)
						);

						a2.vars("q", value);
						a2.updateFilter();
					}

				}, 250); 
			} 
		}]
	]],
	["vcl/ui/List", ("variables"), { 
		align: "client", autoColumns: true, visible: false, 
		source: "array-variables",
		onRender() {
			(this._columns || [])
				.filter(col => col._attribute === "raw")
				.forEach(col => col.hide());
		},
		onDblClick: function() {
			this.print(this.getSelection(true));	
		}
	}],
	["vcl/ui/List", ("measurements"), { 
		align: "client", autoColumns: true, visible: false, 
		css: { ".row-disabled": "color: silver;", },
		source: "array-measurements",
		vars: { autoColumns: { capitalize: false, attributeInFront: false } },
		onDblClick: function() {
			this.print(this.getSelection(true));	
		},
		onSelectionChange() {
			let sel  = this.getSelection();
			this.ud("#toggle-set-measurement-disabled").setEnabled(sel.length > 0);
		},
		onRowGetClasses(row) {
			let obj = this._source.getAttributeValue(".", row._rowIndex, true);
			return obj.disabled ? "row-disabled" : "row-enabled";
		}
	}],
	["vcl/ui/Panel", ("container-renderer"), { align: "client", visible: false } ]
]];