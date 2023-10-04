

# `2023/10/03`

- Adjusted fixed margins for charts to enhance embedding in PDFs.
- Modified the blue series to black and the green series to Excel green.
- Implemented consistent use of constants for GDS attributes.
- Removed obsolete code.
- Began adjustments to accommodate GDS files with selective stages.

# `2023/09/28`

- Automatically enabled/disabled UI and calculations for filter paper and membrane correction based on GDS file content.

# `2023/09/27`

- Removed the "1st 400 measurements" feature/bug.
- Fixed an issue where "Time since start of test (s)" could have duplicate values.
- Updated documentation.
- Fixed the Mohr-Coulomb failure line/envelope and cleaned up some unused variables and unnecessary or confusing comments.
- Updated the documentation.
- Fixed a bug where the same categoryField was used for multiple series.

# `2023/09/26`

- Introduced cooler colors and explored the correct formula for _sigma3_ (o3).
- Changed the default for Evk.
- Adjusted columns to prevent auto-capitalization and shuffling.
- Developed 20230303-1, verified and fixed graphs, implemented membrane correction based on ASTM D4767-11/NEN 5117 and Greeuw et al., restored measurement columns, and made cosmetic changes in bar-inputs.

# `2023/09/19`

- Updated the documentation.
- Refactored locales to the src-root level (multiple commits).
- Verified membrane & filter paper corrections.

# `2023/08/17`

- Refactored measurements-disabled, added "ignore invalid measurements" UI, added (serialized) description to graphs, kept track of modified state, and added save changes functionality.

# `2023/08/16`

- Fixed a styling bug where graphs being edited would show underlying graphs through.
- Made changes to stages.SA in the graphs section, used Back Volume for Volumeverandering-graph, added a feature to disable measurements (preventing them from being plotted), and updated visible columns for measurements.

# `2023/07/20`

- Refactored findEv => byEv, considered all measurements for Mohr-Coulomb (instead of 400), and added a falenverloop trendline (multiple commits).

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