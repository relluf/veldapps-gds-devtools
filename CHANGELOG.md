### 2024/02/11: 2.0.11

* Fixes the linear regression variants for Koppejan
* Adds a feature allowing control over the linear regression variant for Koppejan to be used, via the global KJ_slopes.consolidationAfter setting

### 2024/02/07: 2.0.10

* Refactors data-shifting to origin-shifting
* Adds Util.attributeNameOf(), resolves a string to a full column name or undefined
* Implements origin-shifting during setup in setup_shifting() for EHSR, moves values of all GDS columns involved in calculation

### 2024/02/06: 2.0.9

* updates chart default settings for reporting/PDF-generation implements data-shifting feature, moving the origin of the graphs
* updates chart styling (blue cursor lines, bullet-size) adds data-shifting feature, move the origin of graphs (alt+click in edit-mode) for all graphs individually, persistent state via OnderzoekResource improves general chart rendering performance adds default columns for #measurements
* updates initial selection settings for casagrande, taylor and isotachen graphs adds bullet styling to all graphs configures editing-bullets for bjerrum, isotachen
* adds triaxial test types
* reduces number of visible columns of measurements list via vars("autoColumns.attributes") - defaults to defaultAttributes improves column filtering, allows for exact or startsWith pattern works around vcl/ui/ListColumn visibility bug #VA20240202-1

### 2024/02/02: 2.0.8

* Adds extra validation calculations concerning Koppejan and linear regressions (as requested by Salvador Paz Noriega)
* Adjusts calculation for dV (after checkup with Jacques Nsengiyumva)
* Adjusts scale on X-axis of Mohr Coulomb graphs to fit all circles

### 2024/01/23: 2.0.7

* Validates shifted settlements and extrapolation for Koppejan

### 2024/01/18: 2.0.5, 2.0.6

* Adjusts scaling X-axis for Bjerrum (minimum) and Koppejan (maximum) based upon data
* Improves log\_line\_intersect for small deltas (still not failsafe though)
* Adjusts `extrp()` for Koppejan 
* Fixed an issue with `vpnn` in Casagrande
* Changed some default values used during PDF generation (in favor of Jacques Nsengiyumva)

### 2024/01/14 

* Enhances and bugfixes CSV-export
* Replaces `undefined` values to empty strings
* Support for filtering dataset and columns

### 2024/01/12 

* Fixed a bug where the scale of the X-axis for Koppejan graphs was insufficient to display the loading regime.

### 2024/01/11 

* Fixed a bug where calculating Casagrande variables could crash when not enough vnnp points were found (determine AB & DEF)
* DISABLED FOR NOW: Adjustments made to test new extrp function, debugging Koppejan-parameters (#VA20240108-1)

### 2024/01/10: 2.0.4

* Adjustments made to test new extrp function, debugging Koppejan-parameters (#VA20240108-1)

### 2023/12/07: 2.0.3

*  Allows for selecting 1, 2 or 3 specimens for reporting CUIc tests

### 2023/12/06: 2.0.2

* Adds the trend line according to the secant effective friction angle in the case only 1 specimen is reported (CUIc)

### 2023/11/28: 2.0.1

* Allows for editing, loading and saving of trend lines in the graphs _Volumeverandering_ and _Mohr-Coulomb_

### 2023/11/22: 2.0.0

* In favor of veldoffice-gtlab-vcl release

# `2023/10/03` veldoffice-geografie-vcl@v139b

- **Bugfix**: Addressed an issue related to line modifications and variable refreshment before generating a report. This bug was initially introduced due to changes required for the triaxial test.
- **Improvement**: Moving forward, a specific test setup will be utilized for the triaxial test to prevent the unstable behavior experienced in the compression test reporting.
- **Note**: Further details about the new test setup and subsequent changes will be shared in due course.

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