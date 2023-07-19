define(["text!./vcl-comps/devtools/Editor$/gds.js", "text!./vcl-comps/devtools/Renderer$/gds.js", "text!./vcl-comps/devtools/Renderer$/settlement.js", "text!./vcl-comps/devtools/Renderer$/triaxial.js", "./vcl-comps/devtools/Renderer$/locales/prototype", "./vcl-comps/devtools/Renderer$/locales/nl", "./vcl-comps/devtools/../../Util"], 
(Editor, Renderer, settlement, triaxial, proto, nl, Util) => {
	
	console.log("veldapps-gds-devtools");
	
	define("text!vcl-comps/devtools/Editor$/gds.js", Editor);
	define("text!vcl-comps/devtools/Renderer$/gds.js", Renderer);
	define("text!vcl-comps/devtools/Renderer$/settlement.js", settlement);
	define("text!vcl-comps/devtools/Renderer$/triaxial.js", triaxial);
	
	define("vcl-comps/devtools/Renderer$/Util", Util);
	define("vcl-comps/devtools/Renderer$/locales/prototype", proto);
	define("vcl-comps/devtools/Renderer$/locales/nl", nl);

	require(["text!vcl-comps/devtools/Editor$/gds.js"]);
	require(["text!vcl-comps/devtools/Renderer$/gds.js"]);
	require(["text!vcl-comps/devtools/Renderer$/settlement.js"]);
	require(["text!vcl-comps/devtools/Renderer$/triaxial.js"]);
	
	return { 
		
		'Editor<gds>': Editor,
		'Renderer<gds>': Renderer,
		'Renderer<settlement>': settlement,
		'Renderer<triaxial>': triaxial,
		
		v: "1.0.0" };
});