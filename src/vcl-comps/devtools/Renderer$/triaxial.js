"use GDSFotos, ./Util, locale!./locales/nl, vcl/ui/Button, vcl/ui/Tab, papaparse/papaparse, amcharts, amcharts.serial, amcharts.xy, lib/node_modules/regression/dist/regression, vcl/ui/Node-closeable, vcl/ui/Input, vcl/ui/Select, util/Hash";

window.locale.loc = 'nl'; // TODO

const locale = window.locale.prefixed("devtools:Renderer:gds:");

const js = require("js");
const regression = require("lib/node_modules/regression/dist/regression");

const GDSFotos = require("GDSFotos");

const GDS = require("./Util");
const Button = require("vcl/ui/Button");
const Tab = require("vcl/ui/Tab");
const Control = require("vcl/Control");
const Input = require("vcl/ui/Input");
const Select = require("vcl/ui/Select");
const Hash = require("util/Hash");

/* Setup (must be called in same order) */
function setup_casagrande(vars) {
	return GDS.setup_casagrande(vars);
}
function setup_taylor(vars) {
	return GDS.setup_taylor(vars);
}
function setup_stages_1(vars, sacosh) {
	/*- find highest "B Value"
	
		B-check - In the sample reports this seems to be recalled by GDS from the datapoint with the highest B-value (see column "B Value").
	*/

	vars.stages.forEach(stage => {
		var N = stage.measurements.length - 1;
		// stage.dH = (() => {
		// 	var min = GDS.valueOf(stage.measurements[0], "Axial Displacement");
		// 	var max = N ? GDS.valueOf(stage.measurements[N - 1], "Axial Displacement") : undefined;
		
		// 	return max === undefined ? 0 : max - min;
		// })();
		stage.dH = GDS.valueOf(stage.measurements[N], "Axial Displacement");
		stage.dV = GDS.valueOf(stage.measurements[0], "Volume Change") - GDS.valueOf(stage.measurements[N], "Volume Change");// * -1;
		stage.ui = GDS.valueOf(stage.measurements[0], "Pore Pressure");
		stage.uf = GDS.valueOf(stage.measurements[N], "Pore Pressure");
		stage.b = GDS.maxOf(stage, "B Value");
		stage["B Value"] = stage.b["B Value"];
	});
	
	if(vars.stages.SA === undefined) {
		vars.stages.SA = vars.stages.saturation = vars.stages[sacosh.SA];
		vars.stages.CO = vars.stages.consolidation = vars.stages[sacosh.CO];
		vars.stages.SH = vars.stages.shearing = vars.stages[sacosh.SH];
	}

	js.mi((vars.stages.SA), {

		// RP = Radial Pressure increase 
		// BP = Back Pressure increasre
		// CP - BP = Cell Pressure - Back Pressure
		// CP = Cell Pressure
		// PP = Pore Water Pressure
		// delta RP / delta CP

	});
	js.mi((vars.stages.CO), {
		type: sacosh.type,
		V: (() => {
			/*- Vc = V0 - ΔVc
			
				Vc: geconsolideerd volume van proefstuk na consolidatie (mm3)
				ΔVc: volumeverandering in proefstuk na consolidatie (mm3)
				V0: volume van proefstuk voor test (mm3)
			
			*/
			return (vars.V - vars.stages.CO.dV) / 1000;
		})(),
		o_3: (() => {
			/*- Effectieve celdruk: σ'3 = σc - ub
	
				σ'3= effectieve celdruk voor consolidatiefase (effective consolidation pressure) (kPa)
				σc= total cell pressure applied in chamber at the time the effective consolidation pressure is reached (kPa)
				ub= total back pressure applied at the time effective consolidation pressure is reached (kPa)
				
				Effectieve Celdruk (kPa): effective cell pressure applied to the specimen before starting the
				consolidation stage. This is the difference between the cell (radial) pressure and the back
				pressure [at the time the target effective consolidation pressure is reached], before allowing
				drainage to take place. The effective cell pressure (or effective consolidation pressure) is
				defined by the test schedule and the calculation allows for verification.
				
			*/
			var N =  vars.stages.CO.measurements.length - 1;
			var mt = vars.stages.CO.measurements[N];
			
			var r = GDS.valueOf(mt, "Eff. Radial Stress");
			var oc = GDS.valueOf(mt, "Radial Pressure");
			var ub = GDS.valueOf(mt, "Back Pressure");
			
			// console.log(js.sf("o_3: %s === %s", oc - ub, r));
			
			return oc - ub;
		})(),
	});
	js.mi((vars.stages.CO), {
		o_1: (() => {
			return vars.stages.CO.o_3; // ??? segun SPN 2023-10-08
			/*-	σ'1= σ'3 + q
			
				σ'1= vertical effective stress at the end of consolidation (kPa)
				σ'3= effective consolidation stress or effective radial stress at the end of consolidation (kPa)
				q= deviator stress applied vertically (kPa)"
			
			*/
			var st = vars.stages.CO;
			var ms = st.measurements;
			var mt = ms[ms.length - 1];
			
			// return GDS.valueOf(mt, "Eff. Radial Stress") + GDS.valueOf(mt, "Deviator Stress");
			return st.o_3 + GDS.valueOf(mt, "Deviator Stress");
		})(),
		H: (() => {
			/*- Hc = 1/3 * dVc/Vc * H0 */
			
			var dVc = vars.stages.CO.dV;
			var V0 = vars.V;
			var H0 = vars.H;

			return H0 - (1/3 * (dVc / V0) * H0);
		})(),
		H_alt: (() => {
			/*-	Hc = H0 - ΔHc
				
				Hc : height of specimen at the end of the consolidation phase (mm)
				H0 : initial height of specimen (mm)
				ΔHc: change in height of specimen during consolidation (mm) (vertical displacement)
				
			*/
			
			return vars.H - vars.stages.CO.dH;
		})()
	});
	js.mi((vars.stages.CO), {
		Evol: (() => {
			/*- εvol;c = ΔVc/V0 x 100
			
				εvol;c: volumetrische rek na consolidatie (%)
				ΔVc: volumeverandering in proefstuk na consolidatie (mm3)
				V0: volume van proefstuk voor test (mm3)
				
			*/
			return (vars.stages.CO.dV / vars.V) * 100;
		})(),
		EvT: (() => {
			
			return (vars.H - vars.stages.CO.H) / vars.H * 100;
			/*-	εv;c = ΔHc / H0 x 100

				εv;c = verticale rek na consolidatie (%)
				Hc : proefstukshoogte na consolidatie (mm)
				H0 : initiële proefstukshoogte (mm)
				ΔHc: proefstukshoogteverandering tijdens consolidatie (mm) (verticale vervorming)
			*/
			// return vars.stages.CO.dH / vars.H * 100;
		})(),
		A: (() => {
			/*- Ac = Vc / Hc */	
			
			return (vars.stages.CO.V / vars.stages.CO.H) * 1000;
		})(),
		A_alt: (() => {
			/*- Ac = (V0 - ΔVc) / (H0 - ΔHc)
			
				Ac: geconsolideerde oppervlakte na consolidatie (mm2)
				Vc: geconsolideerd volume van proefstuk na consolidatie (mm3)
				ΔVc: volumeverandering in proefstuk na consolidatie (mm3)
				V0: volume van proefstuk voor test (mm3)
				Hc : proefstukshoogte na consolidatie (mm)
				H0 : initiële proegstukshoogte (mm)
				ΔHc: proefstukshoogteverandering tijdens consolidatie (mm) (verticale vervorming)
			*/
			var st = vars.stages.CO;
			return (vars.V - st.dV) / (vars.H - st.dH);
		})(),
		K0: (() => {
			/*-	K0 = σ'3/ σ'1
			
				K0 = earth pressure coefficient at rest (Dimensionless)
				σ'3= effective consolidation pressure (kPa)
				σ'1= effective vertical pressure (kPa)"
			*/
			var st = vars.stages.CO;
			return st.o_3 / st.o_1;
		})(),
	});

}
function setup_shifting(vars, root) {
	var shifted = js.get("overrides.origin-shifting", vars);
	for(var attribute in shifted) {
		var info = shifted[attribute];
		for(var i in info) {
			var stage, delta = info[i].delta || 0;
			
			if(i === "0" || i === 0) {
				stage = vars.stages.SH;
			} else {
				const samples = [
			    	js.$[root.ud("#select-sample-1").getValue()], 
			    	js.$[root.ud("#select-sample-2").getValue()], 
			    	js.$[root.ud("#select-sample-3").getValue()]
			    ];
			    
			    stage = samples[i];
			    if(!stage) {
			    	continue;
			    }
				stage = stage.vars("control")
					.qs("#measurements")
					.vars(["variables.stages.SH"]);
			}
			stage.measurements.forEach((mt, i, arr) => {
				const attrs = [];
				if(attribute === "txEHSR_clipped" || attribute === "txDS" || attribute === "") {
					attrs.push(
						"Mean Stress s/Eff. Axial Stress 2", 
						"Max Shear Stress t", 
						"Pore Pressure", 
						"Deviator Stress");
				} else if(attribute === "") {
					attrs.push(attribute);
				}
				if(i + delta < arr.length) {
					attrs.forEach(attr => {
						const aname = GDS.attributeNameOf(mt, attr);
						mt[attr + "___"] = GDS.valueOf(mt, attr);
						mt[aname] = GDS.valueOf(arr[i + delta], attr);
					});
				}
			});
		}
	}
	vars.alreadyShifted = true;
	// delete vars.overrides['origin-shifting'];
}
function setup_measurements(vars) {
/*-
	O = 2 pi r
	A = pi r2
	r = sqrt(A/pi)
*/
	const Ac = js.get("stages.CO.A", vars);
	const r = Math.sqrt(Ac / Math.PI);
	const O = 2 * Math.PI * r;
	
	const back0 = stage => stage.back0 || (stage.back0 = GDS.valueOf(stage.measurements[0], "Back Volume"));
	
	const drainSidesUsed = vars.headerValue("Side Drains Used") === "y";
	const membraneUsed = vars.headerValue("Membrane Thickness") !== undefined;

	vars.stages.forEach(stage => stage.measurements.map((mt, index, arr) => {
		mt.ROS = GDS.rateOfStrain(arr, index);
		mt.txVC = (GDS.valueOf(mt, "Back Volume") - back0(stage)) / -1000;
			// mt.txVC = GDS.valueOf(mt, "Volume Change") * -1;
		mt.txPWPR = GDS.valueOf(mt, "PWP Ratio");
		mt.txDS = GDS.valueOf(mt, "Deviator Stress"); //qs_r
		mt.txWO = GDS.valueOf(mt, "Pore Pressure") - GDS.valueOf(arr[0], "Pore Pressure");
			// mt.txSS = GDS.valueOf(mt, "Eff. Cambridge p'");
			// mt.txSS_2 = GDS.valueOf(mt, "Mean Stress s/Eff. Axial Stress 2");
		if(stage === vars.stages.SH) {
	 		mt.Ev_sc = GDS.valueOf(mt, "Axial Displacement") / (vars.Hi - vars.stages.CO.Hi) / 50000;
	 		mt.Ev_s = GDS.valueOf(mt, "Axial Strain (%)") / 100;
	 		
	 		// CIDc specific calculations
	 		if(index > 0) {
	 			// ∆𝑉s;n = 𝑉b;n-1 − 𝑉b;n
	 			// stage.dV = mt.dV = GDS.valueOf(arr[index - 1], "Back Volume") - GDS.valueOf(mt, "Back Volume");
	 			stage.dV = mt.dV = GDS.valueOf(mt, "Back Volume") / 1000;
	 			
	 			// Evols (%) = ∆𝑉s;n / (Vi - dVc) * 100
	 			mt.Evols = mt.dV / (vars.V - vars.stages.CO.dV) * 100;
	 		}
	 		
			// Filter Paper Correction
			mt.d_o1_fp = (() => { 
				/*-	(∆ σ1) fp = ε1 * Kfp * Pfp * O / (0.02 * Ac)
					             
					ε1: axial strain during shear phase (in decimal form) (if axial strain is in %, it must be divided by 100)
					Kfp: load (when fully mobilized) carried by the filter paper covering a unit length of the specimen perimeter (kPa/mm).
					Pfp: fraction of perimeter covered by the filter paper. Pfp may be up to 0.50 (50 %) of the perimeter of the specimen.
					Ac: specimen area at the end of the consolidation stage (mm2).
					O: circumference of the specimen at the end of the consolidation stage. Can be calculated from the specimen area at the end of consolidation stage. (mm)
				*/
				if(!drainSidesUsed) return 0;
		
				var E1 = mt.Ev_s;
				var Kfp = vars.Kfp, Pfp = vars.Pfp / 100;
				var Ac_ = Ac / 1000000;
				var O_ = O / 1000;

		 		if(E1 < 2) {
		 			return E1 * Kfp * Pfp * O_ / (0.02 * Ac_);
		 		}
		 		
		 		return Kfp * Pfp * O_ / Ac_;
			})();
			// Membrane Correction [CO, SH] – ISO/TS 17892-9 
			mt.d_o1_m = (() => {
				/*-	vertical:	(∆σ1)m = (4*t*E) / D1 [ (ε1)m + ((εvol)m / 3)]

					(ε1)m: vertical strain of the membrane (expressed in decimal form).
					(εvol)m: volumetric strain of the membrane (expressed in decimal form).
					D1: initial diameter of the membrane (diameter before it is placed on specimen) (mm).
					t: initial thickness of the membrane (mm)
					E: elastic modulus for the membrane, measured in tension (kPa)					
				*/
				
				var E1_m = 1; // TODO Ask Salvador
				var Evol_m = 2;
				var D1 = vars.D;
				var t = vars.t;
				var E = vars.Em;
				
				return (4 * t * E) / D1 * ( E1_m + (Evol_m / 3) );
			})();
			mt.d_o3_m = (() => {
				/*-	horizontal:	(∆σ3)m = (4*t*E) / D1 [ (εvol)m / 3]
					
					(ε1)m: vertical strain of the membrane (expressed in decimal form).
					(εvol)m: volumetric strain of the membrane (expressed in decimal form).
					D1: initial diameter of the membrane (diameter before it is placed on specimen) (mm).
					t: initial thickness of the membrane (mm)
					E: elastic modulus for the membrane, measured in tension (kPa)					
				*/
				var E1_m = 1;
				var Evol_m = 2;
				var D1 = vars.D;
				var t = vars.t;
				var E = vars.Em;
				
				return (4 * t * E) / D1 * ( Evol_m / 3 );
			})();
			// Membrane Correction [SH] – based on ASTM D4767-11/NEN 5117 and Greeuw et al.
			mt.d_o1_m_alt = (() => {
				/*-	(∆σ1)m = α*(4*t*E*εv;s / (D1 × 100))
					(∆σ1)m = α*(4*t*E*εv;knikpunt) / (D1 × 100)
							 +β(4*t*E*(εv;s − εv;knikpunt)) / (D1 × 100)
					
					α: B7-correction factor (slope) for first segment of bilinear function (unitless)
					β: B8-correction factor (slope) for second segment of bilinear function (unitless)
					εv;s: H14-axial strain during shear phase, with respect to height of specimen at the beginning of shear stage (decimal form)
					εv;knikpunt: B9-axial strain where breakpoint is defined, as a function of the calibration data (in %).
					(Δσ1)m: vertical stress correction due to membrane (kPa), applicable in the raw deviator stress.
					D1: initial diameter of the membrane (diameter before it is placed on specimen) (mm).
					t: B5 - initial thickness of the membrane (mm)
					E: B6 - elastic modulus for the membrane, measured in tension (kPa)
				*/

				var a = vars.alpha, b = vars.beta;
				var Ev_s = mt.Ev_s, Ev_k = vars.Evk / 100;
				var D1 = vars.D, t = vars.tm, E = vars.Em;
				
				return !membraneUsed ? 0 : (Ev_s < Ev_k ?
					 a * (4 * t * E * Ev_s / D1) :
					(a * (4 * t * E * Ev_k / D1) + b * (4 * t * E * (Ev_s - Ev_k) / D1)));

			})();
			mt.d_o1_m_alt1 = (() => {
				const a = vars.alpha, b = vars.beta;
				const Ev_s = mt.Ev_s, Ev_k = vars.Evk / 100;
				const t = vars.tm, E = vars.Em;
				const Ac_ = Ac;

				var commonDenominator = Math.sqrt(4 * Ac_ / Math.PI);
			    if (Ev_s < Ev_k) {
			        result = Ev_s * a * 4 * E * t / commonDenominator;
			    } else {
			        result = 
			        	(Ev_k * a * 4 * E * t / commonDenominator) + 
			        	((Ev_s - Ev_k) * b * 4 * E * t / commonDenominator);
			    }

			    return result;
			})();

	 		mt.qs_r = mt.txDS;
	 		mt.qs_c = mt.qs_r - mt.d_o1_fp - mt.d_o1_m_alt;
	 		
	 		mt.d_u = (() => { 
	 			/*- Excess Porewater Pressure:  this is the difference between the porewater pressure (PWP) measurement on each data row and the base porewater pressure at the beginning of the shear stage 
		 			( ∆ u = un;s − u0;s ; 
		 				subindex “n” represents the datarow number, 
		 				“s” denotes the shear stage 
		 				and “0” the value for the first data row in the shear stage
		 			). 
	 			*/
	 			var pwp = GDS.valueOf(mt, "Pore Pressure");
	 			var base = GDS.valueOf(arr[0], "Pore Pressure");
	 			
	 			return pwp - base;
	 		})();
	 		mt.o3 = (() => { 
	 			/*- Horizontal Stress (kPa):  the total horizontal stress on each data row is, essentially, the registered value of the cell pressure or chamber pressure MINUS the back pressure. In principle, this value should not change since it is the effective pressure at which consolidation took place (in absence of excess pore pressure at the end of consolidation, the horizontal stress and the effective horizontal stress are essentially the same). However, it is advisable to register and calculate the horizontal stress for each data row to look whether or not the pressures are maintained.  */
	 			
				// var cp = GDS.valueOf(mt, "Radial Pressure");
				// var bp = GDS.valueOf(mt, "Back Pressure");
				// mt['o3_cp-bp'] = cp - bp; mt['o3_cp-bp+d_u'] = cp - bp + mt.d_u; return cp - bp + mt.d_u; // 20230717: mt.d_u added as seen in '2023-1 Tx.xls' 

				/* 20230924: [GDS-Reports_HB104-1 Tx_Rev 20.09.2023] suggest the following alternative: */
				var s = GDS.valueOf(mt, "Mean Stress s/Eff. Axial Stress 2");
				var t = GDS.valueOf(mt, "Max Shear Stress t");
				
				return s - t + mt.d_u;
	 		})();
	 		mt.o1 = (() => { 
	 			/*- Vertical Stress (kPa): σ1 = σ3 + qs;corrected */
	 			return mt.o3 + mt.qs_c;
	 		})();
	 		mt.o_3 = (() => { 
	 			/*- Horizontal Effective Stress (kPa): σ′3 = σ3 − ∆u */
	 			return mt.o3 - mt.d_u;
	 		})();
	 		mt.o_1 = (() => { 
	 			/*- Vertical Effective Stress (kPa): σ′1 = σ1 − ∆u */
	 			return mt.o1 - mt.d_u;
	 		})();
	 		mt.o_1o_3 = (() => {
	 			/* Effective Principal Stress Ratio (σ’1 / σ’3) */
	 			return mt.o_1 / mt.o_3;
	 		})();
		
			mt.mes_p_ = (() => { 
				/* - Mean Effective Stress (p’) (kPa): 
				
				this is the average of the three stress directions acting in 
				the specimen. In triaxial compression tests, this is calculated by 
				
				p′ = (σ′1 + 2σ′3) / 3
				
				Note that the effective radial (horizontal) stress is multiplied by 
				two since it is acting around the specimen, while the effective 
				vertical stress acts only along the axis of the specimen. */
				
				return (mt.o_1 + 2 * mt.o_3 ) / 3;
			})();
			mt.ds_q = (() => {
				/*- Deviator Stress (q) (kPa): q = σ′1 − σ′3 */
				return mt.o_1 - mt.o_3;
			})();
			mt.ens_s_ = (() => {
				/* Effective Normal Stress (s’) (kPa): s' = (σ′1 + σ′3) / 2 */
				return (mt.o_1 + mt.o_3) / 2;
			})();
			mt.ss_t = (() => {
				/* Shear Stress (t) (kPa):  t = (σ′1 − σ′3) / 2 */
				return (mt.o_1 - mt.o_3) / 2;
			})();

			mt.txEHSR = mt.o_1o_3;
			if(mt.txEHSR < (vars.txEHSR_max || 20) && mt.txEHSR >= (vars.txEHSR_min || 0)) {
				mt.txEHSR_clipped = mt.txEHSR;
			}
		}
	}));
}
function setup_stages_2(vars) {
	js.mi((vars.stages.CO), {
		t100: (() => {
			// https://raw.githubusercontent.com/relluf/screenshots/master/uPic/202310/20231013-161656-iVa3bt.png
		    const x = "minutes_sqrt", y = "txVC";
			const stm = vars.stages.CO.measurements;
		    const ls = GDS.find_linear_segment(stm, x, y);
		    const max = GDS.maxOf({measurements: stm}, y);
		
			ls.m = (ls.end[y] - ls.start[y]) / (ls.end[x] - ls.start[x]);
			ls.b = ls.start[y] - ls.m * ls.start[x];
			
			return (max[y] - ls.b) / ls.m;
		})()
	});
	js.mi((vars.stages.CO), {
		cvT: (() => {
			
			// https://raw.githubusercontent.com/relluf/screenshots/master/uPic/202310/20231012-131957-qBO6x5.png
			
			var c = 1.652;
			var D = vars.D;
			var H = vars.H;
			var t100 = vars.stages.CO.t100;
			var f = 1 / (365.2 * 24 * 3600);
			
			// based on whether filter paper is being used, the lambda changes
			const fp = vars.headerValue("Side Drains Used") === "y";
			var r = H/D;
			var lambda = fp ? 4 * (1 + 2*r) * (1 + 2*r) : r * r;

			return f * (c * D * D) / (lambda * t100 * t100); // m2/year
		})(),
		cvT_alt: (() => {
			/*-	cv;20 = 0.848 * L2 * fT / t90x
			
				-L: length of drainage path = 0.5*H (half of the specimen height of drainage from both ends) (m)
				-t90: time to 90% primary consolidation (s)
				-fT: temperature correction factor."
			*/
			var stage = vars.stages.CO;
			var L = 0.5 * stage.Hi; 
			var fT = 1, cf = 0.848;
			var t = stage.taylor.t90[0];
			return t !== undefined ? cf * (L*L / (1000*1000)) * fT / t : t;
		})()
	});
	js.mi((vars.stages.CO), {
		// cvi: (() => {
			
		// 	var D0 = vars.D;
		// 	var H0 = vars.H;
		// 	var t100 = Math.sqrt(3);
			
		// 	return Math.PI / (D0 * D0) / ((H0 / D0) * (H0 / D0) * t100);
			
		// })(),
		mvT: (() => {
			/*- mv = 1 / o'c * (dVc / V0) 
			
				mv : volume compressibility (MPa-1)
			*/
			
			var dVc = vars.stages.CO.dV;
			var V0 = vars.V;
			var o_c = vars.stages.CO.o_3;
			
			return 1 / o_c * (dVc / V0);
		})(),
		mvT_alt: (() => {
			/*- mv = ΔVc/V0 / (ui - uc) x 1000
			
				mv : volume compressibility (MPa-1)
				ΔVc: volumeverandering in proefstuk na consolidatie (mm3)
				V0: volume van proefstuk voor test (mm3)
				ui: poriënwaterspanning bij begin van consolidatie (kPa)
				uf: poriënwaterspanning bij eind van consolidatiefase (kPa)
			*/
			var st = vars.stages.CO;
			return (st.dV / vars.V) / (st.ui - st.uf) * 1000;
		})()
	});
	// js.mi((vars.stages.SH), {
	// 	Vf: (() => {
	// 		// 𝑉f = 𝑉0 − ∆𝑉c − ∆𝑉s
	// 		return vars.V - vars.stages.CO.dV - vars.stages.SH.dV;
	// 	})()
	// })
}
function setup_mohr_coulomb(vars, root) {
	const stage = vars.stages.SH;
	const max_q = GDS.maxOf(stage, "qs_c");
	const max_o_1o_3 = GDS.maxOf(stage, "o_1o_3");
	const usr_Ev = GDS.byEv(stage, vars.Ev_usr);

	const values = (mt) => ({
		Ev: GDS.valueOf(mt, "Axial Strain"),
		q_corr: mt.qs_c,
		o_3: mt.o_3,//GDS.valueOf(mt, "Eff. Radial Stress"),//mt.o_3,
		o_1: mt.o_1,
		o_1o_3: mt.o_1o_3,
		p_: mt.mes_p_,
		s_: mt.ens_s_,//(mt.o_1 + mt.o_3) / 2,
		t: mt.ss_t,//(mt.o_1 - mt.o_3) / 2,
		e50und: (() => {
			/*- E50;und = (qmax/2) / (εqmax / 2 / 100) / (1000)
			
				E50;und = Young's modulus at 50% of maximum deviator stress (MPa)
				qmax= maximum deviator stress (kPa) (corrected!)
				εqmax= axial strain at maximum deviator stress (in %)
				
				GEGEVENS:
				qmax = 250 kPa
				εqmax = 12 %

				E50;und = (250/2)/(12/2/100)/(1000)
				E50;und = 2.08 MPa
			*/
			var q_max = mt.qs_c;
			var E_q_max = GDS.valueOf(mt, "Axial Strain");
			
			return (q_max / 2) / (E_q_max / 2 / 100) / 1000;
		})(),
		mt: mt
	});
	js.mi((stage), {
		// Mohr-Coulomb Parameters bij Max Deviatorspanning
		// max q -	Called from calculation section, field "Axial Strain (%)", corresponding to max corrected deviator stress
		max_q: values(max_q), 

		// Mohr-Coulomb Parameters bij Max Hoofdspanningsverhouding σ'1/σ'3
		// max o1 - Called from calculation section; field "Axial Strain (%)", corresponding to max effective stress ratio σ'1/σ'3.
		max_o_1o_3: values(max_o_1o_3),
		
		// Mohr-Coulomb Parameters bij NN % Axiale Rek
		// max o_3 - Called from calculation section; field "Axial Strain (%)". User-defined strain value for which values and parameters will be reported.
		usr_Ev: values(usr_Ev)
	});

	const shss = [
    	js.$[root.ud("#select-sample-1").getValue()], 
    	js.$[root.ud("#select-sample-2").getValue()], 
    	js.$[root.ud("#select-sample-3").getValue()]
    ]
    	.map(n => n && n.qs("devtools/Editor<gds>:root"))
    	.map(r => r && r.vars(["variables.stages.SH"]))
    	.filter(o => o);

    // if(shss.length !== 3) return root.print("mohr canceled: " + shss.length, root.vars(["resource.uri"]));

	["max_q", "max_o_1o_3", "usr_Ev"].forEach((k, i) => {

		const x = shss.map(e => e[k].mt.ens_s_);
		const y = shss.map(e => e[k].mt.ss_t);
		const mohr = GDS.calc_slopeAndYIntercept(x, y);

		mohr.phi_ = Math.asin(mohr.a) / (2 * Math.PI) * 360;
		mohr.c_ = mohr.b / Math.cos(mohr.phi_ * Math.PI / 180);

		for(var s = 0; s < shss.length; ++s) {
			shss[s][k].mohr = js.mi(mohr);

			js.mi(shss[s][k].mohr, {
				r: (shss[s][k].o_1 - shss[s][k].o_3) / 2,
				x: (shss[s][k].o_1 + shss[s][k].o_3) / 2,
				y: 0
			});
			
			// phi's = sin-1 ((o_1 - o_3) / (o_1 + o_3))
			// https://raw.githubusercontent.com/relluf/screenshots/master/uPic/202312/20231206-140003-hNI8V2.png
			shss[s][k].mohr.phi_s = Math.asin((shss[s][k].o_1 - shss[s][k].o_3) / (shss[s][k].o_1 + shss[s][k].o_3)) * (180 / Math.PI);

			shss[s][k].mohr.serie = (() => {
				var center = shss[s][k].mohr;
				var radius = shss[s][k].mohr.r;
				var points = [];
	
				for (var theta = 0; theta <= 2 * Math.PI; theta += Math.PI / 90) {
					var x = center.x + radius * Math.cos(theta);
					var y = center.y + radius * Math.sin(theta);
					
					if(y >= 0) {
						points[points.push({x: x, y: y}) - 1]["mc_y" + s] = y;
					} else if(!points.closed) {
						points[points.push({x: x, y: y}) - 1]["mc_y" + s] = 0;
						points.closed = true;
					}
				}
	
				return points;
			})();
		}
	});
	if(vars.categories && vars.categories.length === 11) {
		refresh_mohr_coulomb_parameters(vars);
		root.print("mohr params refreshed", root.vars(["resource.uri"]));
	} else {
		// root.print("mohr ready", root.vars(["resource.uri"]));
	}
}
function setup_parameters(vars) { 
	const hvis = (section, items) => items.map(item => {
		var k, r = {
			name: locale(js.sf("Section:%s-%s", section, item[0]))
		};

		["unit", "symbol"].map(key => {
			if(locale.has((k = js.sf("Section:%s-%s.%s", section, item[0], key)))) {
				r[key] = locale(k);
			}
		});
		
		if(r.symbol) {
			r.value = js.get(r.symbol, vars);
		}

		if(typeof item[1] === "string") {
			r.value = vars.headerValue(item[1], true);
		} else if(typeof item[1] === "function") {
			r.value = item[1](r.value);
		} else if(!isNaN(r.value) && r.value < 1.0e-03 && r.value > -1.0e-3) {
			r.value = r.value.toExponential(3);
		}
		
		if(typeof item[2] === "function") { // transform
			r.value = item[2](r.value);
		}

		return r;
	});
	const category = (section, items, cb) => {
		var r = {
			name: locale("Section:" + section + ".title"),
			items: hvis(section, items)
		};
		if(cb) cb(r);
		return r;
	};
	
/*- E8: A0 = π/4 * D0^2 */
	vars.A = vars.Ai = Math.PI / 4 * vars.D * vars.D;	
	vars.mi = vars.m;
	vars.mdi = vars.md;

/*-	E12: ρ0;nat = m0;nat / (π/4 * D02 * H0) * 1000 */
	if(isNaN(vars.pi)) {
		vars.pi = vars.mi / (Math.PI/4 * vars.D * vars.D * vars.H) * 1000;
	}

/*-	E13: ρ0;droog = m0;droog / (π/4 * D02 * H0) * 1000 */
	if(isNaN(vars.pdi)) {
		vars.pdi = vars.mdi / (Math.PI/4 * vars.D * vars.D * vars.H) * 1000;
	}

/*- E14: w0 (%) = ( m0;nat - m0;droog) / m0;droog * 100 % */
	if(isNaN(vars.wi)) {
		vars.wi = (vars.mi - vars.mdi) / vars.mdi * 100;
	}
	
/*-	E17: e0 = ρs/ρd - 1 */
	if(isNaN(vars.ei = vars.e0)) {
		vars.ei = vars.e0 = vars.ps / vars.pdi - 1;
	}

/*-	E15: S0 = (w0 * ρs) / (e0 * ρs) */
	vars.Sri = (vars.wi * vars.ps) / (vars.e0 * vars.pw);
	// S0 = (w0 * ρs) / (e0 * ρs)
		// -S0: degree of saturation (%)
		// -w0= initial water content (%)
		// -ρs= particle density (Mg/m3)
		// -ρw= water density at test temperature (Mg/m3)
	
/*-	E20 wf (%) = ( mf;nat - m0;droog) / m0;droog * 100 % */
	if(isNaN(vars.wf)) {
		vars.wf = (vars.mf - vars.mdi) / vars.mdi * 100;
	}

/*- E21 ρf;nat = mf;nat / (π/4 * D0^2 * H0 - ΔVc - ΔV) * 1000 * 1000 (corrected) */
	if(isNaN(vars.pf)) {
		vars.pf = vars.mf / (Math.PI / 4 * vars.D * vars.D * vars.H - vars.stages.CO.dV - vars.stages.SH.dV * 0) * 1000;
	}
/*- E22 ρf;droog = m0;droog / (π/4 * D0^2 * H0) * 1000 * 1000 */
	if(isNaN(vars.pdf)) {
		vars.pdf = vars.mdi / (Math.PI / 4 * vars.D * vars.D * vars.H) * 1000;
	}
	
	const meas_b = (st, name) => GDS.valueOf(vars.stages[st].b, name);
	const meas_0 = (st, name) => GDS.valueOf(vars.stages[st].measurements[0], name);
	const meas_N = (st, name) => GDS.valueOf(vars.stages[st].measurements[vars.stages[st].measurements.length - 1], name);

	const shearItems = [
			["axialStrain"],
			["deviatorStressCorrected"],
			["effectiveHorizontalStress"],
			["effectiveVerticalStress"],
			["sigma1/3"],
			["s_"],
			["t"],
			["phi_"],
			["c_"],
			["a"],
			["b"],
			["e50und"],
			["phi_s"]
		];

	const adjustC = (type, key, value) => (c) => {
		if(value !== undefined) {
			c.name += js.sf(" - %s", js.sf(locale("Section:ShearPhase-" + type), value));
		} else {
			c.name += js.sf(" - %s", locale("Section:ShearPhase-" + type));
		}
		c.items.forEach(item => {
			if(item.symbol && item.symbol.startsWith(".")) {
				item.value = js.get(js.sf("stages.SH.%s.%s", key, item.symbol.substring(1)), vars);
				if(item.symbol.endsWith("phi_") || item.symbol.endsWith("c_")) {
					item.value = Math.round(item.value + 0.5);
				}
			}
		});
	};
	
	vars.categories = [
		category(("Project"), [
			["projectcode", "Job reference"],
			["description", "Job Location"],
			["borehole", "Borehole"],
			["sample", "Sample Name"],
			["date", "Sample Date"]
		]),
		category(("Sample"), [
			["description", "Description of Sample"],
			["specimen", "Depth"],
			["commotion", "Specimen Type"]
		]),
		category(("Initial"), [
			["height", "Initial Height"],
			["diameter", "Initial Diameter"],
			["surface"],
			["volume"],
			["sampleMassWet", "Initial Mass"],
			["sampleMassDry", "Initial dry mass"],
			["densityWet"],
			["densityDry"],
			["waterContent"],
			["saturation"],
			["grainDensity"],
			["poreNumber"]
		]),
		category(("Final"), [
			["densityWet"],
			["densityDry"],
			["waterContent"],
			["poreNumber"]
		]),
		category(("TestRun"), [
			["start", "Date Test Started"],
			["end", "Date Test Finished"],
			["drainTopUsed", "Top Drain Used", GDS.drainUsed],
			["drainBaseUsed", "Base Drain Used", GDS.drainUsed],
			["drainSidesUsed", "Side Drains Used", GDS.drainUsed],
			["pressureSystem", "Pressure System"],
			["cellNumber", "Cell No."]
		]),
		category(("Saturation"), [
			["increaseCellPressure", () => meas_b("SA", "Radial Pressure") - meas_0("SA", "Radial Pressure")],
			["increaseBackPressure", () => meas_b("SA", "Back Pressure") - meas_0("SA", "Back Pressure")],
			["differentialPressure", () => meas_b("SA", "Radial Pressure") - meas_b("SA", "Back Pressure")],
			["saturationPressure", () => meas_b("SA", "Radial Pressure")],
			["poreWaterPressure", () => meas_b("SA", "Pore Pressure")],
			["bAfterSaturation", () => meas_b("SA", "B Value")]
		]),
		category(("Consolidation"), [
			["effectiveCellPressure"], 
			["cellPressure", () => meas_N("CO", "Radial Pressure")], 
			["backPressure", () => meas_N("CO", "Back Pressure")],
			["poreWaterOverpressure", () => meas_N("CO", "Pore Pressure") - meas_N("CO", "Back Pressure")],
			["finalPoreWaterPressure", () => meas_N("CO", "Pore Pressure")],
			["consolidatedVolume"],
			["volumetricStrain"],
			["consolidatedHeight"],
			["consolidatedArea"],
			["volumeCompressibility"],
			["consolidationCoefficient"],
			["verticalStrain"],
			["effectiveVerticalStress"],
			["k0AfterConsolidation"],
			["consolidationType", () => vars.stages.CO.type]
		]),
		category(("ShearPhase"), [
			["cellPressure", () => meas_0("SH", "Radial Pressure")],
			["poreWaterPressure", () => meas_0("SH", "Pore Pressure")],
			["strainRate", () => {
				var mts = vars.stages.SH.measurements;
				return mts.reduce((t, mt) => t += mt.ROS, 0) / mts.length;
			}]
		]),
		category(("ShearPhase"), shearItems, adjustC("maxDeviatorStress", "max_q")),
		category(("ShearPhase"), shearItems, adjustC("maxPrincipalStressRatio", "max_o_1o_3")),
		category(("ShearPhase"), shearItems, adjustC("axialStrainNN%", "usr_Ev", vars.Ev_usr || 2))
	];
	vars.parameters = vars.categories.map(_ => (_.items || []).map(kvp => js.mi({ category: _ }, kvp))).flat();
	vars.parameters.update = () => {};
	vars.refresh_mohr_coulomb_parameters = () => refresh_mohr_coulomb_parameters(vars);
}
function refresh_mohr_coulomb_parameters(vars) {
	if(vars.categories && vars.categories.length === 11) {
		const flavors = ["max_q", "max_o_1o_3", "usr_Ev"];

		// for(let i = 8; i < 11; ++i) {
		// 	// flavors.forEach(key => {
		// 		vars.categories[i].items.forEach((item, idx) => {
		// 			if(item.symbol && item.symbol.startsWith(".")) {
		// 				console.log(idx + "-" + key, 
		// 					item.value = js.get(js.sf("stages.SH.%s.%s", key, 
		// 						item.symbol.substring(1)), vars)
		// 				);
		// 			}
		// 		});
		// 	// })
		// }
		
		vars.parameters
			.filter(p => vars.categories.indexOf(p.category) >= 8)
			.forEach(p => {
				const flavor = flavors[vars.categories.indexOf(p.category) - 8];
				if(p.symbol && p.symbol.startsWith(".")) {
					p.value = js.get(js.sf("stages.SH.%s.%s", flavor, 
						p.symbol.substring(1)), vars)
				}
			});
	}
}

function select_colors(root) {
	return [
    	js.$[root.qs("#select-sample-1").getValue()], 
    	js.$[root.qs("#select-sample-2").getValue()], 
    	js.$[root.qs("#select-sample-3").getValue()]
    ]
    	.map((c, i) => c ? GDS.colors[i] : null)
    	.filter(v => v);
}
function getSampleMeasurements(comp, vars, dontRefresh) {
	const refresh = (node) => { // HACKER-THE-HACK but seems to work nicely
		node.setTimeout("refresh", () => {
			const naam = node.vars("instance").getAttributeValue("naam");
			const tree = node.getTree();
			const sel = tree.getSelection();
			
			comp.setState("invalidated");
			comp.app().toast({content: js.sf("%s wordt geladen...", naam), classes: "glassy fade"})
			tree.setSelection([node]);
			tree.setTimeout("restore", () => tree.setSelection(sel), 500);
		}, 500);
	}
	const nodes = [
    	js.$[comp.ud("#select-sample-1").getValue()], 
    	js.$[comp.ud("#select-sample-2").getValue()], 
    	js.$[comp.ud("#select-sample-3").getValue()]
    ];
    const sampleMeasurements = nodes
    	.map(node => node && node.qs("#array-measurements"))
    	.map(arr => arr && arr.getArray())
    	.filter(arr => arr);

    if(sampleMeasurements[0] && sampleMeasurements[0][0].txVC === undefined) {
    	return !dontRefresh && refresh(nodes[0]);
    }
    if(sampleMeasurements[1] && sampleMeasurements[1][0].txVC === undefined) {
    	return !dontRefresh && refresh(nodes[1]);
    }
    if(sampleMeasurements[2] && sampleMeasurements[2][0].txVC === undefined) {
    	return !dontRefresh && refresh(nodes[2]);
    }
    
    return sampleMeasurements;
}
function makeChart(c, opts) {
	function render(options) {
		var node = options.node || this.getNode();
	
		var defaults = {
			mouseWheelZoomEnabled: true, zoomOutText: " ", 
			mouseWheelScrollEnabled: false,

			autoMargins: !c.ud("#graphs").hasClass("generate"),
			marginLeft: 75,
			marginRight: 55,
			marginTop: 10,
			marginBottom: 30,
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
		    	categoryBalloonColor: "#e0e0e0",
		    	color:"black",
		        cursorAlpha:0.25,
		        cursorColor:"rgb(56,121,217)",
		        valueLineAlpha:0.25,
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
		    colors: ["rgb(0,0,0)", "black"],
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
			    xField: serie.categoryField || "x", 
			    yField: serie.valueField || "y",
			    yAxis: serie.yAxis || "y1",
			    bullet: "none", bulletSize: 6, 
			    maxBulletSize: 6, minBulletSize: 6,
			    // bulletBorderColor: "red", bulletBorderThickness: 2,
			    bulletAlpha: 0.5
			    
		    }, serie);
		});
		
		var serializing = this.ud("#graphs").hasClass("pdf");
		options.valueAxes.forEach(ax => {
			ax.precision = 2;
			ax.balloonTextFunction = (v) => parseFloat(v).toFixed(4).replace(/[.]*0*$/g, "");
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

		var emit = (a, b) => this.emit(a, b);
		var chart = AmCharts.makeChart(node, options);

		this.vars("am.chart", chart);
		this.print(this.vars("am"));

		chart.addListener("drawn", (e) => emit("rendered", [e, "drawn"]));
		chart.addListener("dataUpdated", (e) => emit("rendered", [e, "dataUpdated"]));
		chart.addListener("rendered", (e) => emit("rendered", [e]));
		chart.chartCursor.addListener("moved", (e) => {
			emit("cursor-moved", [e]);
			this.vars("last-cursor-moved", e);
		});
		chart.chartCursor.addListener("changed", (e) => {
			// emit("cursor-changed", [e]);
			this.vars("last-cursor-changed", e);
		});
		
		chart.addListener("clickGraph", (e) => {
			const evt = this.vars("last-cursor-moved");
			const teg = this.udr("#toggle-edit-graph");
			const active = teg.getState();
			if(active && evt && e.event.altKey) {
				const names = [
			    	js.$[this.ud("#select-sample-1").getValue()], 
			    	js.$[this.ud("#select-sample-2").getValue()], 
			    	js.$[this.ud("#select-sample-3").getValue()]
				].filter(n => n).map(n => n.vars("instance._values.naam"));

				const attribute = e.target.valueField;
				const attr = attribute.substring(0, attribute.length - 1);
				const index = e.target.index;
				const vars = this.vars(["variables"]);
				const shifted = js.get(`overrides.origin-shifting.${attr}.${index}`, vars);
				
				if(shifted) {
					if(confirm(`NULPUNT VERSCHUIVING\n\nHet nulpunt van de grafiek voor monster ${names[index]} is reeds verschoven en dient eerst te worden hersteld alvorens een nieuw nulpunt kan worden bepaald.\n\nKies OK om het nulpunt te herstellen en kies daarna een nieuw nulpunt.`)) {
						
						teg.execute();
						this.setTimeout("teg", _=> teg.execute(), 500);

						delete vars.overrides['origin-shifting'][attr][index];
						this.udr("#renderer #refresh").execute();
						this.ud("#modified").setState(true);
					}
					return;
				}
				

				const x = e.chart.valueAxes[1].coordinateToValue(evt.x);
				const y = e.chart.valueAxes[0].coordinateToValue(evt.y);
				
				let delta = chart.dataProvider.findIndex(item => item[attribute] >= y);

				if(confirm(`NULPUNT VERSCHUIVING\n\nHet nulpunt van de grafiek voor monster ${names[index]} wordt verschoven naar:\n\n- X: ${chart.dataProvider[delta][e.target.categoryField]},\n- Y: ${chart.dataProvider[delta][attribute]}\n\nKies OK om door te gaan.`)) {

					if(shifted) delta += shifted.delta;
					teg.execute();
					
					js.set(`overrides.origin-shifting.${attr}.${index}`, { x: x, y: y, delta: delta }, vars);
					this.udr("#renderer #refresh").execute();
					this.ud("#modified").setState(true);
				}
			}
		});

		// chart.addListener("init", (e) => emit("rendered", [e, "init"]));
		// chart.addListener("zoomed", (e) => emit("zoomed", [e]));
		// chart.addListener("changed", (e) => emit("changed", [e]));
	}
	opts.immediate ? render.apply(c, [opts || {}]) : c.nextTick(() => render.apply(c, [opts || {}]));
}
function renderChart(vars, seriesTitle, valueAxisTitle, valueField, categoryField, selected, logarithmic = false, reversed = true, time_key = GDS.key_t, opts = {}) {
/*-
	- `vars` is an object that contains various variables, including an array of stages (`vars.stages`) to iterate over.
	- `seriesTitle` is a string that represents the title of the chart series.
	- `valueAxisTitle` is a string that represents the title of the value axis of the chart.
	- `valueField` is a string that specifies the field used for the values in the chart.
	- `categoryField` is a string that specifies the field used for the categories in the chart.
	- `selected` (string) indicates which stage is selected (SA, CO or SH)
	- `logarithmic` is an optional boolean parameter that indicates whether the value axis should use a logarithmic scale. It defaults to `false`.
	- `opts`
*/
	var sampleMeasurements_ = getSampleMeasurements(this, vars);
	if(!sampleMeasurements_) return;

	let sampleMeasurements = [
    	js.$[this.ud("#select-sample-1").getValue()], 
    	js.$[this.ud("#select-sample-2").getValue()], 
    	js.$[this.ud("#select-sample-3").getValue()]
    ]
    	.filter(v => v)
    	.map(node => node.qs("devtools/Editor<>:root").vars("variables.stages." + selected))
    	.map(stage => stage.measurements);

    var content = ["<div><img src='/shared/vcl/images/loading.gif'></div>"];
    var render_stages = [vars.stages[selected]];
    this._node.innerHTML = content.join("");
    this.vars("rendering", true);

	const shifted = js.get(`overrides.origin-shifting.${valueField}`, vars);
	this.print("shifted." + valueField, shifted);
	
    const index = {};
	sampleMeasurements.map((arr, i) => {
    	return arr.map((mt_s, j) => {
    		let s = GDS.valueOf(mt_s, time_key);
    		let mt_d = index[s] = index[s] || {};
    		let delta = vars.alreadyShifted ? 0 : ((shifted && shifted[i]) || {}).delta || 0;
    		let category = mt_s[categoryField];
    		if(delta && j + delta < arr.length) {
    			mt_s = arr[j + delta];
    		}
    		
    		mt_s = js.mi(mt_s);
    		if(j + delta < arr.length) {
				mt_s[valueField] = arr[j + delta][valueField]; 
    		}
    		
    		mt_d['mt_' + (i + 1)] = mt_s;
    		mt_d[valueField + (i + 1)] = mt_s[valueField];
    		mt_d[categoryField + (i + 1)] = category;
    		return mt_s;
    	});
    });

	const remove = false; //this.ud("#input-removeInvalidMts").getValue(); disabled for now
	const all = Object.keys(index).map(key => index[key]);
	const stageMeasurements = vars.stages.map((st, i) => all
			.filter(mt => remove === false || [1, 2, 3].every(i => mt.hasOwnProperty("mt_" + i))));
			// .filter(mt => sampleMeasurements.every((a, i) => js.get("mt_" + (i+1) + ".disabled", mt) !== true)));
			
	if(typeof opts === "function") {
		opts = opts({
			sampleMeasurements: sampleMeasurements, 
			stageMeasurements: stageMeasurements
		});
	}

    const render = () => {
        const stage = render_stages[st];
        const series = sampleMeasurements.map((mts, i) => ({
            title: js.sf(seriesTitle, selected),
            valueAxis: "y1",
            valueField: valueField + (i + 1),
            categoryField: categoryField + (i + 1),
        }));
        const extopt = (path, def) => js.mi(def, js.get(path, opts) || {});
        
        this.vars("am", {
            series: series,
            stage: stage,
            data: stageMeasurements[st]
        });
        this.vars("am-" + st, this.vars("am"));

        makeChart(this, {
            immediate: true,
            node: this.getChildNode(st),
            colors: select_colors(this.up(), GDS.colors),
            trendLines: opts.trendLines || [],
            valueAxes: [
            	extopt("valueAxes.y1", {
	                id: "y1",
	                position: "left",
	                reversed: reversed
	            }), 
	            extopt("valueAxes.x1", {
	                id: "x1",
	                position: "bottom",
	                title: js.sf(valueAxisTitle, selected) + (shifted ? ` [${Object.keys(shifted).map(i=>parseInt(i, 10) + 1).filter(i=>i<=sampleMeasurements.length).join("")}]` : ""),
	                logarithmic: logarithmic,
	                treatZeroAs: GDS.treatZeroAs
	            })
	         ]
        });
        
		if(series.length) this.getChildNode(st).qs("svg")._description = series[0].title;

        if (++st < render_stages.length) {
            this.nextTick(render);
        } else {
        	this.getChildNode(0).classList.add("print");
        	this.vars("rendering", false);
        }
    };

    var st = 0;
    render_stages.length && render();
}
function renderChart_MohrCircles(vars, seriesTitle, valueAxisTitle) {
/*-
	- `vars` is an object that contains various variables, including an array of stages (`vars.stages`) to iterate over.
	- `seriesTitle` is a string that represents the title of the chart series.
	- `valueAxisTitle` is a string that represents the title of the value axis of the chart.
*/
	var sampleMeasurements = getSampleMeasurements(this, vars);
	if(!sampleMeasurements) return;
	
	if(!js.get("stages.SH.usr_Ev.mohr.phi_", vars)) {
		setup_mohr_coulomb(vars, this);
	}

	if((vars.parameters.filter(p => p.name === "φ'")[0] || {}).value === undefined) {
		// this.print("phi_", js.get("stages.SH.usr_Ev.mohr.phi_", vars));
		refresh_mohr_coulomb_parameters(vars);
		this.print("mohr ready", this.vars(["resource.uri"]));
	}
	
	const shss = [
    	js.$[this.ud("#select-sample-1").getValue()], 
    	js.$[this.ud("#select-sample-2").getValue()], 
    	js.$[this.ud("#select-sample-3").getValue()]
    ]
    	.filter(n => n)
    	.map(n => n.qs("devtools/Editor<gds>:root"))
    	.map(r => r.vars(["variables.stages.SH"]))
    	.filter(o => o && o.usr_Ev.mohr);
	
	const measurements = shss.map(ss => ss.usr_Ev.mohr.serie).flat().sort((i1, i2) => {
		return i1.x < i2.x ? -1 : i1.x === i2.x ? 0 : 1;
	});
	
	const series = sampleMeasurements.map((mts, i) => ({
        title: js.sf(seriesTitle, vars.stages.SH.i + 1),
        valueAxis: "y1",
        valueField: "mc_y" + i,
        categoryField: "x"
    }));
    this.vars("am", {
        series: series,
        stage: "SH",
        data: measurements
    });
    
    if(!shss.length) return;

    const mohr = shss[0].usr_Ev.mohr;

    // Convert phi' from degrees to radians
    // Calculate t' using the Mohr-Coulomb failure criterion (https://chat.openai.com/c/15ea4974-6905-47a4-ad0b-7893c28134a3)
	const t_ = (s_) => mohr.c_ + s_ * Math.tan(mohr.phi_ * (Math.PI / 180));
	const max_X = measurements[measurements.length - 1].x * 1.1;

	var trendLine = js.get("overrides.graphs.ShearStress.lines.0", vars);
	if(sampleMeasurements.length === 1) {
		
		trendLine = js.mi(trendLine ? js.mi(trendLine) : {
				initialXValue: 0, initialValue: 0,
				finalXValue: max_X, finalValue: Math.tan(mohr.phi_s / (180 / Math.PI)) * max_X,
				lineColor: "teal", lineAlpha: 0.95
			}, {
				lineThickness: 3, dashLength: 2,
				editable: true
	        });
	} else {
		
		trendLine = js.mi(trendLine ? js.mi(trendLine) : {
				initialXValue: 0, initialValue: t_(0),
				finalXValue: max_X, finalValue: t_(max_X),
				lineColor: "teal", lineAlpha: 0.95
			}, {
				lineThickness: 3, dashLength: 2,
				editable: true
	        });
	}

	// this.print("mohr-info", {tl: trendLine, mohr: mohr});

    makeChart(this, {
        immediate: true,
        node: this.getNode(),
        colors: select_colors(this.up(), GDS.colors),
        valueAxes: [{
            id: "y1",
            position: "left",
            maximum: t_(GDS.maxOf({measurements: measurements}, "x").x + 10)
        }, {
            id: "x1",
            position: "bottom",
            title: js.sf(valueAxisTitle, vars.stages.SH.i + 1),
            treatZeroAs: GDS.treatZeroAs
        }],
        trendLines: [trendLine]
    });
    
	this.getNode().qs("svg")._description = series[0].title;
}
function undoOriginShifting(root, vars) {
	vars.measurements.forEach(mt => {
		Object.keys(mt).filter(k => k.endsWith("___")).forEach(key => {
			mt[key.substring(0, key.length - 3)] = mt[key];
			delete mt[key];
		});
	});
}


/* Event Handlers */
const handlers = {
	'#panel-edit-graph > vcl/ui/Input onChange': function(evt) {
		// this.print("delegating to bar-user-inputs");
		this.ud("#bar-user-inputs").fire("onDispatchChildEvent", [evt.sender, "change", evt, null, arguments])
	},
	
	'#bar-user-inputs onLoad'() { 
		// this.print("onLoad");
		this.nextTick(() => this.nodeNeeded());
		this.nextTick(() => this.ud("#refresh").execute());
	},
	'#bar-user-inputs onNodeCreated'() {
		// this.print("onNodeCreated");

		this.setParent(this.udr("#bar").getParent());
		this.setIndex(1);
		
		this.ud("#refresh-select-samples").execute();
	},
	
	'#bar-user-inputs onRender'() {
		var vars = this.vars(["variables"]);
		if(vars === undefined) return;// this.print("onRender-blocked - no vars");
		
		var stages = this.vars("stages");
		if(stages === vars.stages.length) return;// this.print("onRender-blocked - stages equals", vars);
		
		this.vars("stages", vars.stages.length);
		stages = vars.stages;
		
		if(!stages.SA) { // TODO maybe these should be read from vars
			stages.SA = stages[stages.length - 3]
		}
		if(!stages.CO) {
			stages.CO = stages[stages.length - 2]
		}
		if(!stages.SH) {
			stages.SH = stages[stages.length - 1]
		}

		var options = stages.map((s, i, a) => ({
			content: js.sf("%s %d", locale("Stage"), s.number),
			value: i
		}));
		this.ud("#select-stage-SA").set({ 
			options: options, 
			value: stages.indexOf(stages.SA)
		});
		this.ud("#select-stage-CO").set({ 
			options: options, 
			value: stages.indexOf(stages.CO)
		});
		this.ud("#select-stage-SH").set({ 
			options: options, 
			value: stages.indexOf(stages.SH)
		});
	},
	'#bar-user-inputs onDispatchChildEvent'(component, name, evt, f, args) {
		if(name === "change") {
			if(!this.isEnabled()) return ;//this.print("ignored bar-user-inputs change");

			var modified = this.ud("#modified");
			var blocked = modified.vars("blocked");
			var parent = component.getParent();
			var value = component.getValue();

			if(value) {
				// finds all other selects which value equals component's value and resets their value
				parent
					.qsa("< vcl/ui/Select")
					.filter(s => s !== component && s.getValue() === value)
					.forEach(s => s.setValue(""));
			}

			this.setTimeout("refresh", () => {
	    		var vars = this.vars(["variables"]);

				if(vars && vars.stages) {	    		
		    		delete vars.stages.SA;
		    		delete vars.stages.CO;
		    		delete vars.stages.SH;
		    		
		    		var inputs = Object.fromEntries(this.qsa("< *")
						.filter(c => (c instanceof Input) || (c instanceof Select))
						.map(c => [c._name, c.getValue()]));
						
		    		js.set("overrides.inputs", inputs, vars);

					this.ud("#refresh").execute();

					if(!blocked) {
						modified.setState(true);
					}
				}
			}, 250);
		}
	},
	
	'#graph_VolumeChange onRender'() {
	    var vars = this.vars(["variables"]) || { stages: [] };
	    var selected = "CO";
	    
        const valueField = "txVC", categoryField = "minutes_sqrt";
        const trendLines = [], guides = [];
        const changedLines = js.get("overrides.graphs.VolumeChange.lines", vars) || [];

	    this.setTimeout("render", _=>renderChart.call(this, vars, 
	    	locale("Graph:VolumeChange.title.stage-F"), 
	    	locale("Graph:VolumeChange.title.stage-F"),
	    	"txVC", "minutes_sqrt", selected, false, true, GDS.key_t, 
	    	(evt) => { // callback to provide options and get a grip on calculated stageMeasurements
		        const stageMeasurements = evt.stageMeasurements;

				const colors = [
			    	js.$[this.ud("#select-sample-1").getValue()], 
			    	js.$[this.ud("#select-sample-2").getValue()], 
			    	js.$[this.ud("#select-sample-3").getValue()]
			    ].map((o, i) => o && GDS.colors[i]).filter(o => o);
		        
		        evt.sampleMeasurements.forEach((a, i) => {
		        	const stm = stageMeasurements[i];
			        const x = categoryField + (i + 1), y = valueField + (i + 1);
			        const ls = GDS.find_linear_segment(stm, x, y);
			        const max = GDS.maxOf({measurements: stm}, y)

					ls.m = (ls.end[y] - ls.start[y]) / (ls.end[x] - ls.start[x]);
					ls.b = ls.start[y] - ls.m * ls.start[x];

			        const lastLine = changedLines[i * 4 + 3] ? js.mixIn({
							lineColor: colors[i], lineAlpha: 0.35, editable: true
			            }, changedLines[i * 4 + 3]) : {
					        initialXValue: -ls.b / ls.m, initialValue: 0,
					        finalXValue: ls.end[x] * 10, finalValue: ls.m * ls.end[x] * 10 + ls.b,
					        lineColor: colors[i], lineAlpha: 0.35, editable: true
			            };
			            
					const t100 = (max[y] - ls.b) / ls.m;
		            trendLines.push({
						initialXValue: ls.start[x], initialValue: 0, //vertical ls-range
						finalXValue: ls.start[x], finalValue: 100,
						lineColor: colors[i], lineAlpha: 0.5,
						dashLength: 2
		            }, {
						initialXValue: ls.end[x], initialValue: 0, //vertical ls-range
						finalXValue: ls.end[x], finalValue: 100,
						lineColor: colors[i], lineAlpha: 0.5,
						dashLength: 2
		            }, {
						initialXValue: 0, initialValue: max[y], //horizontal 100% consolidation line
						finalXValue: 100, finalValue: max[y],
						lineColor: colors[i], lineAlpha: 0.5,
						dashLength: 2
		            }, 
		            lastLine);
		            guides.push({
		            	label: "t100", 
		            	above: true, inside: true,
				        position: "bottom", 
				        value: t100, lineAlpha: 0.8,
						lineColor: colors[i]
		            })
		        });

	    		return {
		    		valueAxes: { x1: { guides: guides } },
		    		trendLines: trendLines
		    	};
		    }), 0);
	},
	'#graph_PorePressureDissipation onRender'() {
	    var vars = this.vars(["variables"]) || { stages: [] };
	    var selected = "CO";
	
	    this.setTimeout("render", _=>renderChart.call(this, vars, 
	    	locale("Graph:PorePressureDissipation.title.stage-F"), 
	    	locale("Graph:PorePressureDissipation.title.stage-F"), 
	    	"txPWPR", "minutes", selected, true, false, GDS.key_t), 0);
	}, 
	'#graph_DeviatorStress onRender'() {
	    var vars = this.vars(["variables"]) || { stages: [] };
	    var selected = "SH";
	
	    this.setTimeout("render", _=>renderChart.call(this, vars, 
	    	locale("Graph:DeviatorStress.title.stage-F"), 
	    	locale("Graph:DeviatorStress.title.stage-F"), 
	    	"txDS", "Axial Strain (%)", selected, false, false), 0);
	},
	'#graph_WaterOverpressure onRender'() {
	    var vars = this.vars(["variables"]) || { stages: [] };
	    var selected = "SH";
	
	    this.setTimeout("render", _=>renderChart.call(this, vars, 
	    	locale("Graph:WaterOverpressure.title.stage-F"), 
	    	locale("Graph:WaterOverpressure.title.stage-F"), 
	    	"txWO", "Axial Strain (%)", selected, false, false), 0);
	},
	'#graph_EffectiveHighStressRatio onRender'() {
	    var vars = this.vars(["variables"]) || { stages: [] };
	    var selected = "SH";
	    
	    this.setTimeout("render", _=>renderChart.call(this, vars, 
	    	locale("Graph:EffectiveHighStressRatio.title.stage-F"), 
	    	locale("Graph:EffectiveHighStressRatio.title.stage-F"), 
	    	"txEHSR_clipped", "Axial Strain (%)", selected, false, false), 0);
	},
	'#graph_DeviatorStressQ onRender'() {
	    var vars = this.vars(["variables"]) || { stages: [] };
	    var selected = "SH";
	
	    this.setTimeout("render", _=>renderChart.call(this, vars, 
	    	locale("Graph:DeviatorStressQ.title.stage-F"), 
	    	locale("Graph:DeviatorStressQ.title.stage-F"), 
	    	"qs_c", "mes_p_", selected, false, false), 0);
	},
	'#graph_ShearStress onRender'() {
	    var vars = this.vars(["variables"]) || { stages: [] };
	    var selected = "SH";
	
	    this.setTimeout("render", _=>renderChart_MohrCircles.call(this, vars, 
	    	locale("Graph:ShearStress.title.stage-F"), 
	    	locale("Graph:ShearStress.title.stage-F")), 0);
	},
	'#graph_VolumeChange_SS onRender'() {
	    var vars = this.vars(["variables"]) || { stages: [] };
	    var selected = "SH";
	
	    this.setTimeout("render", _=>renderChart.call(this, vars, 
	    	locale("Graph:VolumeChange_SS.title.stage-F"), 
	    	locale("Graph:VolumeChange_SS.title.stage-F"), 
	    	"dV", "Axial Strain (%)", selected), 0);
	},
	'#graph_Taylor onRender'() {
		this.setTimeout("render", () => {
			var vars = this.vars(["variables"]) || { stages: [] };
			var selected = [4];
	
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
		}, 5);
	},
	
	// TODO refactor to onDispatchChildEvent of graphs, as well as in settlement-code
	"#graph_VolumeChange cursor-moved": GDS.TrendLine.cursorMoved,
	"#graph_ShearStress cursor-moved": GDS.TrendLine.cursorMoved,
	"#graph_Taylor cursor-moved": GDS.TrendLine.cursorMoved,
	
	'.-photo-placeholder tap'(evt) {
		if(evt.target.classList.contains("fa-trash")) {
			evt.target.up().qs("img").src = "";
			this.removeClass("has-photo");
			this.removeClass("is-uploaded");
			this.removeVar("ddh-item");
			this.removeVar("ddh-item-hash");
			this.removeVar("vo:foto");
			this.ud("#modified").setState(true);
		} else {
			const ddh = this.app().qs("DragDropHandler<>:root");
			this.getParent().vars("photo-placeholder", this);
			ddh.vars("input").click();
		}
	},
};
const defaultAttributes = "|Stage|Time|Volume Change|Pore Pressure|PWP Ratio|Axial Strain|tx|dV |qs_c |txEHSR_clipped|qs_r|d_u|d_o1_m_alt|d_o1_fp|qs_c|Excess PWP|o1 |o3 |o_1 |o_3 |mes_p_|Eff. Stress Ratio|".split("|").filter(a => a);

[(""), {
	onLoad() {
		const ddh = this.app().qs("DragDropHandler<>:root");
		const group = this.qs("#group_fotos");
		
		this.nextTick(_=> { // wait for owner change, currently #0 (vcl/Application) owns this
			const list = this._owner.down("#measurements");
			this._owner.print(this, this._owner);
			list.vars("autoColumns.attributes", defaultAttributes);
		});

		this.override({
			visibleChanged() {
				const is = this.isVisible();
// TODO this should be refactored to Tabs<Document>
				if(is && !this.vars("listeners")) {
					this.vars("listeners", ddh.on({
						'dragover': () => {
							group.vars("photo-placeholder", null);
						},
						'before-dropped': () => {
							// console.log("before-dropped");
						},
						'dropped': (evt) => { // really need -this- to be Editor<gds>
							const items = evt.items || evt.files;
							const tapped = group.vars("photo-placeholder");
							const d = !tapped ? 1 : tapped.getIndex();
							
							group.addClass("loading");
							group.setTimeout(() => Promise
								.all(items.map(i => Promise.resolve(i.readerResult)))
								.then(res => items.forEach((item, i) => {
									var el = group.getControl(i + d);
									if(el) {
										var img = el.getNode().qs("img");
										if(img) {
											this.setTimeout(js.sf("%d_%d", i, Date.now()), () => {
												GDSFotos.drawThumb(img, item.readerResult);
											}, 0);
											el.vars("ddh-item", item);
										}
										el.syncClass("has-photo", !!img);
									}
								}))
								.then(() => this.ud("#modified").setState(true))
								.finally(() => {
									GDSFotos.refresh(this);
									group.removeClass("loading");
								}), 500);
						},
						'after-dropped': () => {
							// console.log("after-dropped");
						},
						'dragenter': (evt) => {
							group.vars("photo-placeholder", null);
						},
						'dragleave': (evt) => {
							// const group = this.qs("#group_fotos");
							// group.vars("photo-placeholder", null);
						}
					}));
					this.nextTick(() => { // allow STOP to be done first? not really necessary for the check on parentNode
						ddh.setEnabled(true);
						ddh.vars("parentNode", group.getNode());
						// this.print("START", this.vars("listeners"));
					});
				} else if(!is && this.vars("listeners")) {
					if(ddh.vars("parentNode") === group.getNode()) {
						ddh.un(this.removeVar("listeners"));
						ddh.setEnabled(false);
						// this.print("STOPPED");
					}
				}
				
				return this.inherited(arguments);
			}
		});
		return this.inherited(arguments);
	},
	handlers: handlers,
	vars: { 
		layout: "grafieken/documenten/Triaxiaalproef", 'layout-test': true,
		graphs: [
			"VolumeChange",
			"PorePressureDissipation",
			"DeviatorStress",
			"WaterOverpressure",
			"EffectiveHighStressRatio",
			"ShearStress",
			"DeviatorStressQ",
			"VolumeChange_SS",
		],
		setup() {
			const vars = this.vars(["variables"]), n = vars.stages.length;
			const sacosh = {SA: n - 3, CO: n - 2, SH: n - 1};

			((setup_triaxial) => {
				let adm = this.udr("#allow-disabling-measurements");
				adm.vars("visible", false);
				adm.toggle("visible"); adm.toggle("visible");
			})();

			// ((setup_triaxial_code) => {
				var disabled = js.get("overrides.measurements-disabled", vars) || [];
				disabled.forEach(index => vars.measurements[index].disabled = true);
				
				const drainSidesUsed = vars.headerValue("Side Drains Used") === "y";
				const membraneUsed = vars.headerValue("Membrane Thickness") !== undefined;
	
				this.qsa(":vars(filterpaper)").set("visible", drainSidesUsed);
				this.qsa(":vars(membrane)").set("visible", membraneUsed);
	
				var inputs = js.get("overrides.inputs", vars);
				var bar = this.ud("#bar-user-inputs");
				bar.setEnabled(false);
				for(var k in inputs) {
					if(!k.startsWith("select-sample-")) {
						var c = this.qs("#" + k);
						if(c && c.setValue) {
							c.setValue(inputs[k]);
						}
					}
				}
				bar.update(() => bar.setEnabled(true));
	
				["Kfp", "Pfp", "tm", "Em", "Evk", "alpha", "beta", "txEHSR_min", "txEHSR_max", "Ev_usr"]
					.forEach(key => {
						vars[key] = parseFloat(this.ud("#input-" + key).getValue())
					});
					
				if(!Object.keys(sacosh).every(k => {
					if(isNaN(sacosh[k] = parseInt(this.ud("#select-stage-" + k).getValue(), 10))) {
	
						vars.parameters = [];
						vars.categories = [];
						
						// this.print("cleared parameters & categories");
	
						return false;
					}
					return true;
				})) return this.ud("#bar-user-inputs").render();
				
				sacosh.type = this.ud("#input-CO-type").getValue();
				
				var type = this.ud("#select-type").getValue();
				if(type === "") {
					this.ud("#select-type").setValue(type = "CIUc");
				}

				this.ud("#tabs-graphs")
					.getControls().filter(c => c instanceof Tab)
					.forEach(tab => tab.setVisible((tab.vars("types") || []).includes(type)));


			// })();
			
			// setup_casagrande(vars);
			setup_taylor(vars);
			setup_stages_1(vars, sacosh);
			setup_shifting(vars, this);
			setup_measurements(vars);
			setup_stages_2(vars);
			setup_mohr_coulomb(vars, this);
			setup_parameters(vars);

		}
	}
}, [
    ["vcl/Action", ("refresh-select-samples"), {
    	on() { // TODO implement devtools/Workspace<>-environment as well :-p
    		this.setEnabled(false);

			let modified = this.ud("#modified");
			modified.vars("blocked", Date.now());
    	
    		let node = this.up("vcl/ui/Node-closeable");
			let sel = this.up("vcl/ui/Node-closeable").up()
					.qsa("vcl/ui/Node-closeable")
					.filter(n => n.vars("instance"))
					.map(n => ({ n: n, d: n.vars("instance") }))
					.filter((o, i, a) => o.d.getAttributeValue && (a.map(o => o.d).indexOf(o.d) === i))
					.filter(o => o.d.getAttributeValue && (
						o.d.getAttributeValue("naam") || "")
						.toLowerCase().endsWith(".gds")
					);
					
			let index = sel.findIndex((o, i, a) => o.n === node);
			
			if(index + 2 > sel.length - 1) {
				index -= (index + 2) - (sel.length - 1);
				if(index < 0) index = 0;
			}
			
			const NULL_SAMPLE = "- - - - - - - - - - - - -";
					
			for(let i = 1; i <= 3; ++i) {
				let select = this._owner.qs("#select-sample-" + i);
				select.setOptions([{content: NULL_SAMPLE, value: ""}].concat(sel.map(o => ({ 
					value_id: o.d.getAttributeValue("id"), 
					content: o.d.getAttributeValue("naam"),
					value: o.n.hashCode()
				}))));
				if(sel.length >= i + index) {
					select.setValue(sel[i - 1 + index].n.hashCode());
				} else {
					select.setValue(null);
				}
			}
			
    		this.setTimeout("enable", () => {
    			modified.removeVar("blocked");
    			this.setEnabled(true);
    		}, 200);
    	}
    }],
	["vcl/Action", ("report-generate"), {
        content: locale("-/Generate"),
    	on(evt) {
			const refresh = (node) => { // HACKER-THE-HACK but seems to work nicely
				node.setTimeout("refresh", () => {
					const naam = node.vars("instance").getAttributeValue("naam");
					const tree = node.getTree();
					const sel = tree.getSelection();

					this.setState("invalidated");
					this.app().toast({content: js.sf("%s wordt geladen...", naam), classes: "glassy fade"})
					tree.setSelection([node]);

					tree.setTimeout("restore", () => {
						this.execute(evt);
						tree.setSelection(sel);
					}, 500);
				}, 500);
			}
			const nodes = [
		    	js.$[this.ud("#select-sample-1").getValue()], 
		    	js.$[this.ud("#select-sample-2").getValue()], 
		    	js.$[this.ud("#select-sample-3").getValue()]
		    ];
		    const sampleMeasurements = nodes
		    	.map(node => node && node.qs("#array-measurements"))
		    	.map(arr => arr && arr.getArray())
		    	.filter(arr => arr);

		    if(sampleMeasurements[0] && sampleMeasurements[0][0].txVC === undefined) {
		    	return refresh(nodes[0]);
		    }
		    if(sampleMeasurements[1] && sampleMeasurements[1][0].txVC === undefined) {
		    	return refresh(nodes[1]);
		    }
		    if(sampleMeasurements[2] && sampleMeasurements[2][0].txVC === undefined) {
		    	return refresh(nodes[2]);
		    }
		    
			const vars = this.vars(["variables"]);
			["1", "2", "3"]
				.map(i => this.ud("#select-sample-" + i))
				.forEach((select, i) => {
					var value = js.$[select.getValue()];
					if(value && (value = value.vars("control").qs("#renderer"))) {
						value = js.get("categories", value.vars(["variables"]));
						js.set("overrides.sample" + i, value, vars);
					}
				});

			["0", "1", "2"].forEach(i => {
				var s = js.get("overrides.sample" + i, vars);
				if(s) {
					[8, 9, 10].forEach(j => {
						[7, 8, 9, 10].forEach(k => {
							if(!s[j].items[k].value) {
								s[j].items[k].value = 
									js.get(js.sf("overrides.sample0.%s.items.%s.value", j, k), vars) ||
									js.get(js.sf("overrides.sample1.%s.items.%s.value", j, k), vars) ||
									js.get(js.sf("overrides.sample2.%s.items.%s.value", j, k), vars);
							}
						})
					});
				}
			});
				
			this.udr("#generate").execute(evt);
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
                placeholder: ""
            }]
        ]],
        ["vcl/ui/Group", ("group_buttons"), {
            css: "padding-top:8px;"
        }, [
            ["vcl/ui/Button", ("button_generate"), { action: "report-generate" }]
        ]],
        ["vcl/ui/Group", { classes: "seperator" }],
		["vcl/ui/Group", ("group_fotos"), {
			css: {
				'&.loading': "background-image: url(/shared/vcl/images/loading.gif); background-position: 50% 0; background-repeat: no-repeat;",
				'.photo-placeholder': {
					'': "margin: 16px 6px; width: 120px; height: 150px; border-radius: 17px; background-color: #f0f0f0;  padding: 4px; display: inline-block; vertical-align: top;",
					'> div': "border: 3px dashed gray; border-radius: 15px; height: 142px; text-align: center; padding-top: 50%;",

					'&:hover:hover:hover > div': "cursor: pointer; font-weight: bold; border-width: 5px; padding-top: 48%;",
					'&.sample1 > div': "color: rgba(0, 0, 0, 0.55); background-color: rgba(0, 0, 0, 0.05); border-color: rgba(0, 0, 0, 0.55);",
					'&.sample2 > div': "color: rgba(255, 0, 0, 0.55); background-color: rgba(255, 0, 0, 0.05); border-color: rgba(255, 0, 0, 0.55);",
					'&.sample3 > div': "color: rgba(112, 173, 71, 0.55); background-color: rgba(112, 173, 71, 0.05); border-color: rgba(112, 173, 71, 0.55);",
					'img': "pointer-events:none;border-radius: 17px; border: 3px solid transparent; position: relative; top: -100%; width: 100%; height: 100%; object-fit: contain; padding: 3px; background-color: rgba(255,255,255,0.25);",
					'img.selected': "border: 3px solid rgb(56, 121, 217); background-color: rgba(255, 255, 255, 0.2);",
					'i.fa-trash': "top: -123%; left: 75%; color: white; background-color: rgba(0, 0, 0, 0.5); padding: 5px; border-radius: 5px; position: relative; cursor: pointer; z-index: 100;",
					'&.is-uploaded i.fa-trash': "top: -223%;",
					
					'&:not(.is-uploading) .upload-overlay': "display: none;",
					'.upload-overlay': "position: relative; top: -202%; left: 0; width: 0%; height: 100%; background-color: rgba(56,121,217,0.25); transition: width 0.45s ease-in; border-radius: 15px;",
					'&.has-error .upload-overlay': "display: block; width: 100%; background-color: rgba(255,0,0,0.5);",
					'&.is-uploaded .upload-overlay': "display: block; width: 100%; background-color: rgba(56,121,217,0.35);",
					
					'&:not(:hover) i.fa-trash': "display: none;",
					'&:not(.has-photo)': { 
						'img': "display: none;", 
						'i.fa-trash': "display: none;"
					}
				}
			}
		}, [
			["vcl/ui/Element", { classes: "header", content: "Deformatiefoto's" }],
			["vcl/ui/Element", {
				classes: "photo-placeholder sample1",
				content: "<div>Monster 1,<br>foto 1</div><img><dt class='upload-overlay'></dt><i class='fa fa-trash'></i>"
			}],
			["vcl/ui/Element", {
				classes: "photo-placeholder sample1",
				content: "<div>Monster 1,<br>foto 2</div><img><dt class='upload-overlay'></dt><i class='fa fa-trash'></i>"
			}],
			["vcl/ui/Element", {
				classes: "photo-placeholder sample2",
				content: "<div>Monster 2,<br>foto 1</div><img><dt class='upload-overlay'></dt><i class='fa fa-trash'></i>"
			}],
			["vcl/ui/Element", {
				classes: "photo-placeholder sample2",
				content: "<div>Monster 2,<br>foto 2</div><img><dt class='upload-overlay'></dt><i class='fa fa-trash'></i>"
			}],
			["vcl/ui/Element", {
				classes: "photo-placeholder sample3",
				content: "<div>Monster 3,<br>foto 1</div><img><dt class='upload-overlay'></dt><i class='fa fa-trash'></i>"
			}],
			["vcl/ui/Element", {
				classes: "photo-placeholder sample3",
				content: "<div>Monster 3,<br>foto 2</div><img><dt class='upload-overlay'></dt><i class='fa fa-trash'></i>"
			}]
			
		]],
		["vcl/ui/Group", { classes: "seperator" }],
        ["vcl/ui/Group", ("group_options"), {}, [
            ["vcl/ui/Group", [
	            ["vcl/ui/Checkbox", "option_footer", {
	            	classes: "block",
	            	label: "Voettekst weergeven",
	            	checked: true
	            }],
	            ["vcl/ui/Checkbox", "option_logo", {
	            	classes: "block",
	            	label: "Logo weergeven",
	            	checked: true, visible: false
	            }]
			]]
		]]
	]],
    [("#reflect-overrides"), {
    	on(evt) {
    		var vars = this.vars(["variables"]), root = this.up();

    		if(evt.overrides) {
    			vars.overrides = evt.overrides;
    		} else {
    			if(!vars.overrides) return;
    			delete vars.overrides.graphs;
    			delete vars.overrides.photos;
    			delete vars.overrides.inputs;
    			delete vars.overrides['origin-shifting'];
    			this.ud("#bar-user-inputs").getControls().forEach(c => {
    				if(c['@properties'].value !== undefined) {
    					c.revertPropertyValue("value");
    				}
    			});
    			GDSFotos.clearAll(root);
    			undoOriginShifting(root, vars);
    			this.ud("#refresh").execute();
    		}

			this.ud("#graphs").getControls().map(c => c.render());
    	}
    }],
    
    ["vcl/ui/Bar", ("bar-user-inputs"), { 
    	index: 0,
    	css: {
    		"": "border: 1px dashed silver; text-align: center;",
    		"*:not(.{Group}):not(.overflow_handler)": "display: inline-block; margin: 2px;",
    		".{Input}:not(.{Checkbox})": "max-width: 40px; _font-weight:bold;",
    		'.{Select}': "_font-weight:bold;",
    		'>.{Group}': "display: block;"
    	}
    }, [
    	// ["vcl/ui/PopupButton", {
    	// 	content: locale("TriaxialTest.report") + " <i class='fa fa-chevron-down'></i>",
    	// 	css: "position:absolute;left:0;top:0;",
    	// 	popup: "popup-reports"
    	// }],
    	
    	[("vcl/ui/Group"), {
    		css: {
    			'': "position:absolute;left:4px;top:4px;background-color: rgba(240, 240, 240, 0.5);backdrop-filter: blur(10px); border-radius:5px;padding:6px 18px;",
    			".block.block.block": "display:block;"
    		}
    	}, [
	    	["vcl/ui/Element", { classes: "block", content: locale("TriaxialTest.type") + ": " }],
	    	["vcl/ui/Select", ("select-type"), {
	    		options: locale("TriaxialTest.types").map(type => ({value: type, content: type})),
	    		value: "CIU"
	    	}],
	    	["vcl/ui/Select", ("select-ssms"), {
	    		options: ["SS", "MS"].map(type => ({value: type, content: type})),
	    		value: "MS",
	    		onChange() {
	    			const ms = (this.getValue() === "MS");
	    			this.ud("#select-sample-1").getParent().setVisible(ms);
	    			
	    			if(!ms) {
		    			this.ud("#select-sample-2").setValue("");
		    			this.ud("#select-sample-3").setValue("");
	    			} else {
	    				// this.ud("#refresh-select-samples").execute();
	    			}
	    		}
	    	}]
    	]],
    	
    	[("vcl/ui/Group"), [
	    	["vcl/ui/Element", { content: locale("Sample") + " 1:" }],
	    	["vcl/ui/Select", ("select-sample-1"), { css: "border-bottom: 3px solid rgb(0,0,0); background-color: rgba(0,0,0,0.05);" }],
	    	["vcl/ui/Element", { content: locale("Sample") + " 2:" }],
	    	["vcl/ui/Select", ("select-sample-2"), { css: "border-bottom: 3px solid rgb(255,0,0); background-color: rgba(255,0,0 ,0.05);" }],
	    	["vcl/ui/Element", { content: locale("Sample") + " 3:" }],
	    	["vcl/ui/Select", ("select-sample-3"), { css: "border-bottom: 3px solid rgb(112,173,71); background-color: rgba(112,173,71,0.05);",
	    	}],
	    	["vcl/ui/Element", { 
	    		action: "refresh-select-samples",
	    		css: {
	    			'': "cursor:pointer;padding:2px;border-radius:3px;", 
	    			'&:hover': "background-color:#f0f0f0;",
	    			'&:active': "color:red;",
	    			'&:disabled': "color:silver;cursor:default;"
	    		},
	    		content: "<i class='fa fa-refresh'></i>" 
	    	}]
	    ]],
		[("vcl/ui/Group"), [
	    	["vcl/ui/Element", { content: locale("Stage#SA") + ":" }],
	    	["vcl/ui/Select", ("select-stage-SA"), { }],
	    	["vcl/ui/Element", { content: locale("Stage#CO") + ":" }],
	    	["vcl/ui/Select", ("select-stage-CO"), { }],
	    	["vcl/ui/Element", { content: locale("Stage#SH") + ":" }],
	    	["vcl/ui/Select", ("select-stage-SH"), { 
	    		onChange() {
	    			const tab = this.udr("#tab-measurements");
	    			const q = `Stage=${parseInt(this.getValue(), 10) + 1}`;
	    			if(tab.isSelected()) {
	    				this.udr("#q").setValue(q);
	    			} else {
	    				tab.vars("q", q)
	    			}
    			}
	    	}]
	    ]],
    	[("vcl/ui/Group"), [
	    	["vcl/ui/Element", { 
	    		content: locale("Consolidation-type") + ":", visible: false
	    		// hint: locale("Consolidation-type")
	    	}],
	    	["vcl/ui/Select", ("input-CO-type"), { 
	    		visible: false,
	    		options: locale("Consolidation-types.options")
	    	}],
	    	["vcl/ui/Element", { 
	    		content: locale("MohrCoulomb-Ev_usr") + ":",
	    		// hint: locale("MohrCoulomb-Ev_usr.hint")
	    	}],
	    	["vcl/ui/Input", ("input-Ev_usr"), {
				value: locale("MohrCoulomb-Ev_usr.default")
	    	}],
	    	["vcl/ui/Element", { 
	    		content: js.sf("(%H)", locale("MohrCoulomb-Ev_usr.unit")),
	    		// hint: locale("MohrCoulomb-beta.hint")
	    	}],
	    	["vcl/ui/Element", { 
	    		content: locale("EHSR-min") + ":",
	    		// hint: locale("EHSR-min.hint")
	    	}],
	    	["vcl/ui/Input", ("input-txEHSR_min"), { 
	    		value: locale("EHSR-min.default")
	    		// hint: locale("EHSR-min.hint")
	    	}],
	    	["vcl/ui/Element", { 
	    		content: js.sf("(%H)", locale("EHSR-min.unit")),
	    		// hint: locale("EHSR-min.hint")
	    	}],
	    	["vcl/ui/Element", { 
	    		content: locale("EHSR-max") + ":",
	    		// hint: locale("EHSR-max.hint")
	    	}],
	    	["vcl/ui/Input", ("input-txEHSR_max"), { 
	    		value: locale("EHSR-max.default")
	    		// hint: locale("EHSR-max.hint")
	    	}],
	    	["vcl/ui/Element", { 
	    		content: js.sf("(%H)", locale("EHSR-max.unit")),
	    		// hint: locale("EHSR-max.hint")
	    	}],
	    	["vcl/ui/Checkbox", ("input-removeInvalidMts"), {
	    		checked: false, visible: false,
	    		label: locale("Graphs-removeInvalidMeasurements"),
	    		onChange() {
	    			this.up().qsa("#graphs > *").map(g => g.setState("invalidated", g.isVisible()));
	    		}
	    	}]
	    ]],
    	[("vcl/ui/Group"), [
	    	["vcl/ui/Element", { 
	    		content: locale("FilterPaper-loadCarried") + ":",
	    		vars: { filterpaper: 1 }
	    		// hint: locale("FilterPaper-loadCarried.hint")
	    	}],
	    	["vcl/ui/Input", ("input-Kfp"), { 
	    		value: locale("FilterPaper-loadCarried.default"),
	    		vars: { filterpaper: 1 }
	    		// hint: locale("FilterPaper-loadCarried.hint")
	    	}],
	    	["vcl/ui/Element", { 
	    		content: js.sf("(%H)", locale("FilterPaper-loadCarried.unit")),
	    		vars: { filterpaper: 1 }
	    		// hint: locale("FilterPaper-loadCarried.hint")
	    	}],
	    	["vcl/ui/Element", { 
	    		content: locale("FilterPaper-perimeterCovered") + ":",
	    		vars: { filterpaper: 1 }
	    		// hint: locale("FilterPaper-perimeterCovered.hint")
	    	}],
	    	["vcl/ui/Input", ("input-Pfp"), {
	    		value: locale("FilterPaper-perimeterCovered.default"),
	    		vars: { filterpaper: 1 }
	    		// hint: locale("FilterPaper-perimeterCovered.hint")    		
	    	}],
	    	["vcl/ui/Element", { 
	    		content: js.sf("(%H)", locale("FilterPaper-perimeterCovered.unit")),
	    		vars: { filterpaper: 1 }
	    		// hint: locale("FilterPaper-perimeterCovered.hint")
	    	}],
	    	["vcl/ui/Element", { 
	    		content: locale("MembraneCorr-alpha") + ":",
	    		vars: { membrane: 1 }
	    		// hint: locale("MembraneCorr-alpha.hint")
	    	}],
	    	["vcl/ui/Input", ("input-alpha"), {
				value: locale("MembraneCorr-alpha.default"),
	    		vars: { membrane: 1 }
	    	}],
	    	["vcl/ui/Element", { 
	    		content: js.sf("(%H)", locale("MembraneCorr-alpha.unit")),
	    		vars: { membrane: 1 }
	    		// hint: locale("MembraneCorr-alpha.hint")
	    	}],
	    	["vcl/ui/Element", { 
	    		content: locale("MembraneCorr-beta") + ":",
	    		vars: { membrane: 1 }
	    		// hint: locale("MembraneCorr-beta.hint")
	    	}],
	    	["vcl/ui/Input", ("input-beta"), {
				value: locale("MembraneCorr-beta.default"),
	    		vars: { membrane: 1 }
	    	}],
	    	["vcl/ui/Element", { 
	    		content: js.sf("(%H)", locale("MembraneCorr-beta.unit")),
	    		vars: { membrane: 1 }
	    		// hint: locale("MembraneCorr-beta.hint")
	    	}],
	    	["vcl/ui/Element", { 
	    		content: locale("MembraneCorr-tm") + ":",
	    		vars: { membrane: 1 }
	    		// hint: locale("MembraneCorr-tm.hint")
	    	}],
	    	["vcl/ui/Input", ("input-tm"), {
	    		value: locale("MembraneCorr-tm.default"),
	    		vars: { membrane: 1 }
	    	}],
	    	["vcl/ui/Element", { 
	    		content: js.sf("(%H)", locale("MembraneCorr-tm.unit")),
	    		vars: { membrane: 1 }
	    		// hint: locale("MembraneCorr-tm.hint")
	    	}],
	    	["vcl/ui/Element", { 
	    		content: locale("MembraneCorr-Em") + ":",
	    		vars: { membrane: 1 }
	    		// hint: locale("MembraneCorr-Em.hint")
	    	}],
	    	["vcl/ui/Input", ("input-Em"), {
				value: locale("MembraneCorr-Em.default"),
	    		vars: { membrane: 1 }
	    	}],
	    	["vcl/ui/Element", { 
	    		content: js.sf("(%H)", locale("MembraneCorr-Em.unit")),
	    		vars: { membrane: 1 }
	    		// hint: locale("MembraneCorr-Em.hint")
	    	}],
	    	["vcl/ui/Element", { 
	    		content: locale("MembraneCorr-Evk") + ":",
	    		vars: { membrane: 1 }
	    		// hint: locale("MembraneCorr-Evk.hint")
	    	}],
	    	["vcl/ui/Input", ("input-Evk"), {
				value: locale("MembraneCorr-Evk.default"),
	    		vars: { membrane: 1 }
	    	}],
	    	["vcl/ui/Element", { 
	    		content: js.sf("(%H)", locale("MembraneCorr-Evk.unit")),
	    		vars: { membrane: 1 }
	    		// hint: locale("MembraneCorr-Evk.hint")
	    	}]
    	]]
    ]],

	[("#tabs-graphs"), {
		onChange(newTab, curTab) {
			const teg = this.ud("#toggle-edit-graph")
			teg.setVisible(newTab.vars("can-edit") === true);
			if(teg.getState() === true) {
				// commits pending changes
				teg.execute();
			}
		}
	}, [
		["vcl/ui/Tab", { visible: false, text: locale("Graph:VolumeChange"), control: "graph_VolumeChange", vars: { 'can-edit': true, types: ["CIUc", "CIDc"] } }],
		["vcl/ui/Tab", { visible: false, text: locale("Graph:PorePressureDissipation"), control: "graph_PorePressureDissipation", vars: { types: ["CIUc", "CIDc"] } }],
		["vcl/ui/Tab", { visible: false, text: locale("Graph:DeviatorStress"), control: "graph_DeviatorStress", vars: { types: ["CIUc", "CIDc"] } }],
		["vcl/ui/Tab", { visible: false, text: locale("Graph:WaterOverpressure"), control: "graph_WaterOverpressure", vars: { types: ["CIUc", "CIDc"] } }],
		["vcl/ui/Tab", { visible: false, text: locale("Graph:EffectiveHighStressRatio"), control: "graph_EffectiveHighStressRatio", vars: { types: ["CIUc", "CIDc"] } }],
		["vcl/ui/Tab", { visible: false, text: locale("Graph:DeviatorStressQ"), control: "graph_DeviatorStressQ", vars: { types: ["CIUc", "CIDc"] } }],
		["vcl/ui/Tab", { visible: false, text: locale("Graph:VolumeChange_SS"), control: "graph_VolumeChange_SS", vars: { types: ["CIDc"] } }],
		["vcl/ui/Tab", { visible: false, text: locale("Graph:ShearStress"), control: "graph_ShearStress", vars: { 'can-edit': true, types: ["CIUc", "CIDc"] } }],
		["vcl/ui/Tab", { visible: false, text: locale("Graph:Taylor"), control: "graph_Taylor", vars: { types: [ "CIDc"] } }],

		["vcl/ui/Bar", ("menubar"), { align: "right", autoSize: "both", classes: "nested-in-tabs" }, [
			["vcl/ui/Button", ("button-edit-graph"), { 
				action: "toggle-edit-graph",
				classes: "_right", content: "Lijnen muteren"
			}],
			// ["vcl/ui/PopupButton", ("button-edit-graph-stage"), { 
			// 	action: "edit-graph-stage", classes: "_right", origin: "bottom-right",
			// 	content: "Lijnen muteren <i class='fa fa-chevron-down'></i>",
			// 	popup: "popup-edit-graph-stage"
			// }]	
		]]
	]],
	[("#graphs"), { }, [
		["vcl/ui/Panel", ("graph_VolumeChange"), {
			align: "client", visible: false, 
			classes: "single",
			vars: {
				'allow-origin-shifting': false,
				// 'editing-bullets': true, 
				TrendLineEditor_stop(vars, stage, chart, owner) {
					var modified;
					chart.trendLines.forEach((tl, index) => {
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
					
							js.set(js.sf("overrides.graphs.VolumeChange.lines.%s", index), line, vars);
						}
					});
					if(modified) {
						// TODO what to update here instead of:  stage.isotachen.update();
					}
					return modified === true;
				}
			}
		}],
		["vcl/ui/Panel", ("graph_VolumeChange_SS"), {
			align: "client", visible: false, 
			classes: "single",
			// vars: {
			// 	TrendLineEditor_stop(vars, stage, chart, owner) {
			// 		var modified;
			// 		chart.trendLines.forEach((tl, index) => {
			// 			if(tl && tl.modified) {
			// 				modified = true;
			// 				tl.lineThickness = 1;
			// 				tl.draw();
				
			// 				var line = {
			// 					initialXValue: tl.initialXValue,
			// 					initialValue: tl.initialValue,
			// 					finalXValue: tl.finalXValue,
			// 					finalValue: tl.finalValue
			// 				};
					
			// 				js.set(js.sf("overrides.graphs.VolumeChange.lines.%s", index), line, vars);
			// 			}
			// 		});
			// 		if(modified) {
			// 			// TODO what to update here instead of:  stage.isotachen.update();
			// 		}
			// 		return modified === true;
			// 	}
			// }
			vars: {
				'allow-origin-shifting': false
			}
		}],
		["vcl/ui/Panel", ("graph_PorePressureDissipation"), {
			align: "client", visible: false, 
			classes: "single",
			vars: {
				'allow-origin-shifting': false
			}
		}],
		["vcl/ui/Panel", ("graph_DeviatorStress"), {
			align: "client", visible: false, 
			classes: "single",
			vars: {
				'allow-origin-shifting': false
			}
		}],
		["vcl/ui/Panel", ("graph_WaterOverpressure"), {
			align: "client", visible: false, 
			classes: "single",
			vars: {
				'allow-origin-shifting': false
			}
		}],
		["vcl/ui/Panel", ("graph_EffectiveHighStressRatio"), {
			align: "client", visible: false, 
			classes: "single",
			vars: {
				'allow-origin-shifting': true
			}
		}],
		["vcl/ui/Panel", ("graph_DeviatorStressQ"), {
			align: "client", visible: false, 
			classes: "single",
			vars: {
				'allow-origin-shifting': false
			}
		}],
		["vcl/ui/Panel", ("graph_ShearStress"), {
			align: "client", visible: false, 
			classes: "single",
			vars: {
				TrendLineEditor_stop(vars, stage, chart, owner) {
					var modified;
					chart.trendLines.forEach((tl, index) => {
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
					
							js.set(js.sf("overrides.graphs.ShearStress.lines.%s", index), line, vars);
						}
					});
					if(modified) {
						// TODO what to update here instead of:  stage.isotachen.update();
					}
					return modified === true;
				}
			}
		}],
		["vcl/ui/Panel", ("graph_Taylor"), {
			align: "client", visible: false, 
			classes: "multiple"
		}],

		[("#panel-edit-graph"), { css: { '*': "display:inline-block;"} }, [
		]]
	]]
]];