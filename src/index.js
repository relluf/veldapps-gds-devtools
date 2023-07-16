var path = "vcl-comps/devtools/", components = [
	"Editor$/gds.js",
	"Renderer$/gds.js", 
	"Renderer$/settlement.js", 
	"Renderer$/triaxial.js",
	"Renderer$/locales/prototype",
	"Renderer$/locales/nl",
	"../../Util",
].map(s => s.endsWith(".js") ? "text!./" + path + s : "./" + path + s);

define(components, (Editor, Renderer, settlement, triaxial, proto, nl, Util) => {

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
	
	return { v: "1.0.0" };
});

// define([], { v: "1.0.0" });