const sheet='https://docs.google.com/spreadsheets/d/1InVfUqUMoApTDr02GGZ7CWCyKzVZiWv7K0hK1Q5fXj0/edit#gid=2008436455';
export const PARTS={
 'Front enclosure':['Printed front shell','Violet PLA · Medium enclosure. Holds the display, switches, charger and sensing board.','https://www.amazon.fr/dp/B0F48FCLXW'],
 'Rear enclosure':['Printed rear shell','Yellow PLA · Carries the ESP32, battery shelf and four M2 inserts.','https://shop.polymaker.com/en-eu/products/panchroma-matte?variant=43631458484281'],
 'GC9B72 display':['Round TFT display','2.1″ · 360 × 360 pixels · GC9B72 SPI driver. Ten ribbon conductors, nine connected signals.','https://fr.aliexpress.com/item/1005012658991692.html'],
 'ESP32-S3 N16R8':['ESP32-S3 DevKit','N16R8 · 16 MB Flash + 8 MB PSRAM. Runs the badge program and stores its graphics; no SD card.','https://fr.aliexpress.com/item/1005006418608267.html'],
 'LiPo 505060':['Rechargeable LiPo','3.7 V · 2000 mAh · 60 × 50 × 5 mm in this Medium CAD. The purchase sheet lists 503040; this model follows the assembly guide’s 505060 footprint.','https://fr.aliexpress.com/item/1005012388062386.html'],
 'TP4056 + boost':['USB-C charger + boost','TP4056 module · charges the LiPo and supplies regulated 5 V to the DevKit.','https://fr.aliexpress.com/item/1005005522998695.html'],
 'Ground bus + dividers':['Sensing stripboard','5 copper strips × 8 holes · 12.7 × 20.3 mm. Four flat 100 kΩ resistors form the battery and USB sensing dividers.',sheet],
 'Tactile switch 1':['Previous switch','6 × 6 × 5 mm tactile switch · GPIO 20. Hold at boot to enter Wi-Fi OTA mode.','https://fr.aliexpress.com/item/4001360233985.html'],
 'Tactile switch 2':['Centre switch','6 × 6 × 5 mm tactile switch · GPIO 21. Select, menu, long-press sleep and wake.','https://fr.aliexpress.com/item/4001360233985.html'],
 'Tactile switch 3':['Next switch','6 × 6 × 5 mm tactile switch · GPIO 19. Navigate to the next item.','https://fr.aliexpress.com/item/4001360233985.html'],
 'Previous button':['Previous button cap','Printed arrow cap from the supplied small_parts.stl. Fits the previous switch plunger.',sheet],
 'Menu button':['Centre button cap','Yellow printed smiley cap from small_parts.stl. A small glue dot secures it to the centre plunger.',sheet],
 'Next button':['Next button cap','Printed arrow cap from small_parts.stl. Fits the next switch plunger.',sheet],
 'M2 brass insert':['M2 threaded insert','4 per badge · M2 × H4 × Ø3.2 mm. Heat-set into the rear shell, vertical and flush.','https://fr.aliexpress.com/item/1005012293885845.html'],
 'M2×12 screw':['Countersunk M2 screw','4 per badge · M2 × 12 mm for the updated 8.75 mm front. The older purchase sheet lists 10 mm; the revised guide requires 12 mm.','https://fr.aliexpress.com/item/1005006674854536.html'],
 'Screw cap':['Printed screw cap','4 per badge · original small_parts.stl mesh, fitted over the recessed screw heads.',sheet],
 'Strap bar':['Steel strap bar','Ø3 × 29.4 mm · sits across both halves in the upper cradle.','https://www.amazon.fr/dp/B0G566MV48'],
 'Conference lanyard':['Three.js Conf lanyard','Violet woven loop with repeated conference branding, buckle and metal swivel clip. Recreated from your reference image.',sheet],
 'Wire kit':['Ribbon & hook-up wire','10-way rainbow ribbon for the screen, plus 28–30 AWG silicone wire for power, buttons and sensing. Cut to each route.','https://fr.aliexpress.com/item/1005006350734418.html']
};
export function createPartsInfo(){const card=document.querySelector('#part-detail'),select=document.querySelector('#part-select');let pinned=false;
 for(const [name,[title]] of Object.entries(PARTS)){const o=document.createElement('option');o.value=name;o.textContent=title;select.append(o)}
 function show(name,x,y,pin=false){const info=PARTS[name];if(!info)return;card.hidden=false;pinned=pin;card.querySelector('strong').textContent=info[0];card.querySelector('p').textContent=info[1];card.querySelector('a').href=info[2];card.style.left=Math.max(12,Math.min(x+15,innerWidth-300))+'px';card.style.top=Math.max(85,Math.min(y+15,innerHeight-235))+'px';select.value=name;}
 select.onchange=()=>show(select.value,innerWidth/2-145,innerHeight-250,true);
 card.querySelector('button').onclick=()=>{pinned=false;card.hidden=true;};
 return {show,hide(force=false){if(force||!pinned)card.hidden=true;},get pinned(){return pinned;}};
}
