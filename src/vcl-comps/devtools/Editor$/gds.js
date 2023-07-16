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
		'': "float: right; margin:6px 6px 0 0;",
		'&:hover': "background-color: #f0f0f0; cursor: pointer;",
		'&:active': "color: rgb(56, 121, 217);"
	}
};
const handlers = {
	"#tabs-sections onChange"(newTab, curTab) {
		this.ud("#bar").setVisible(newTab && (newTab.vars("bar-hidden") !== true));
		this.print("onchange", [newTab, curTab]);
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

	["vcl/data/Array", ("array-measurements"), {
		onActiveChanged() {
			this.print("onActiveChanged", arguments);	
		},
		onGetAttributeValue: function(name, index, value) { 
			return (this._arr[index] || {})[name]; 
		},
		onFilterObject(obj) {
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
		["vcl/ui/Tab", { text: "Variabelen", control: "variables", selected: !true }],
		["vcl/ui/Tab", { text: "Metingen", control: "measurements" }],
		["vcl/ui/Tab", { text: "Grafieken", control: "container-renderer", selected: true, vars: { 'bar-hidden': true }} ],
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
		["vcl/ui/Input", ("q"), { 
			placeholder: "Filter", 
			onChange() { 
				this.setTimeout("updateFilter", () => {
					var value = this.getValue(), attrs;
					
					if(value.startsWith("|")) {
						attrs = value.split(/(?<!\\)\|/);
						value = attrs.pop();
					}
					
					if(attrs) {
						this.ud("#measurements")._columns.map(
							column => column.setVisible(attrs.filter(a => a).some(a => 
								column._attribute.includes(a))));
					}
					
					var previous = this.vars("previous");
					if(previous && previous.value === value) {
						return;
					}
					
					this.vars("previous", { name: value, value: value, time: Date.now() });

					var a1 = this.udr("#array-variables");
					var a2 = this.ud("#array-measurements");
					a1.vars("q", value);
					a1.updateFilter();

					a2.vars("q", value);
					a2.updateFilter();
				}, 250); 
			} 
		}],
	]],
	["vcl/ui/List", ("variables"), { 
		align: "client", autoColumns: true, visible: false, 
		source: "array-variables",
		onDblClick: function() {
			this.print(this.getSelection(true));	
		}
	}],
	["vcl/ui/List", ("measurements"), { 
		align: "client", autoColumns: true, visible: false, 
		source: "array-measurements",
		onDblClick: function() {
			this.print(this.getSelection(true));	
		}
	}],
	["vcl/ui/Panel", ("container-renderer"), { align: "client", visible: false } ]
]];