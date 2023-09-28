# `2023/07/18`

* Taylor calculations are integrated into the triaxial test reporting
* The vertical displacement during consolidation is calculated in case ∆Ηc is not measured

# `2023/07/07` Seperate package for GDS

Or at least codebase, because it won't be published to NPM.

* [veldapps-gds-devtools](/Workspaces/veldapps.com/:/)

# `2023/07/02` Tidying up, refactoring

* Moved `setup_taylor` to `Util`, so it can be used by `triaxial` as well
* The var `setup` can now be defined at the root level. Seems a nice approach in general, more concise.

![RYwSYP](https://raw.githubusercontent.com/relluf/screenshots/master/uPic/RYwSYP.png)

# `2023/07/06` Refactoring from devtools

* √ move source from cavalion-devtools to this package
	* √ locales
	* √ vcl-comps
* instruct vcl/- and blocks/Factory to use source here
	* should be delegated to RequireJS config/defines
		* √ [Util.js](src/:)
		* √ [devtools/Renderer$/gds.js](src/vcl-comps/:)
		* √ [devtools/Renderer$/settlement.js](src/vcl-comps/:)
		* √ [devtools/Renderer$/triaxial.js](src/vcl-comps/:)
		* √ [devtools/Editor/gds.js](src/vcl-comps/:)
	
![snm5ZX](https://raw.githubusercontent.com/relluf/screenshots/master/uPic/snm5ZX.png)

* [`Object.keys(window.require.s.contexts._.defined).filter(s => s.startsWith("text!") && s.includes("devtools"))`](`!`)