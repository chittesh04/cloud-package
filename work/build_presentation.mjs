import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "C:/Users/chitt/Documents/Codex/2026-10-04/referenced-chatgpt-conversation-this-is-an";
const SKILL_DIR = "C:/Users/chitt/.codex/plugins/cache/openai-primary-runtime/presentations/26.1004.11800/skills/presentations";
const TMP_DIR = path.join(workspaceDir, "work", "ppt-build");
const FINAL_PPTX = path.join(workspaceDir, "outputs", "Hybrid_Cloud_College_Application_Presentation_Final.pptx");
const { resolvePresentationFont, finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, "container_tools", "artifact_tool_utils.mjs")).href);
await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });
const font = resolvePresentationFont();
const ppt = Presentation.create({ slideSize: { width: 1280, height: 720 } });

const C = { navy: "#0B1F33", blue: "#1576C8", teal: "#08A6A6", pale: "#EAF4FA", ink: "#18324A", gray: "#5B7083", line: "#C9D8E5", white: "#FFFFFF", purple: "#6A4BC3", gold: "#D9911C", lightPurple: "#F0ECFF", green: "#178565" };

function text(slide, value, x, y, w, h, size=22, opts={}) {
  const s = slide.shapes.add({ geometry: "textbox", position: { left:x, top:y, width:w, height:h }, fill: "none", line: { fill:"none", width:0 } });
  s.text = value;
  s.text.style = { typeface:font, fontSize:size, color:opts.color || C.ink, bold:opts.bold || false, align:opts.align || "left", verticalAlignment:opts.va || "top", autoFit:"shrinkText", marginLeft:opts.margin ?? 0, marginRight:opts.margin ?? 0, marginTop:opts.margin ?? 0, marginBottom:opts.margin ?? 0 };
  return s;
}
function rect(slide,x,y,w,h,fill=C.white,line=C.line,radius=false) {
  return slide.shapes.add({ geometry:radius?"roundRect":"rect", position:{left:x,top:y,width:w,height:h}, fill, line:{fill:line,width:1} });
}
function title(slide, t, sub="") {
  text(slide,t,70,44,930,55,34,{bold:true,color:C.navy});
  if(sub) text(slide,sub,72,102,980,30,16,{color:C.gray});
  const accent=rect(slide,70,142,1140,3,C.blue,C.blue);
  return accent;
}
function footer(slide,n) { text(slide,"Hybrid Cloud Architecture Design for a Scalable College Application",70,680,870,20,11,{color:C.gray}); text(slide,String(n).padStart(2,"0"),1160,680,50,20,11,{color:C.gray,align:"right"}); }
function label(slide,t,x,y,w,color=C.blue){rect(slide,x,y,w,24,color,color,true);text(slide,t,x,y+4,w,16,10,{bold:true,color:C.white,align:"center"});}
function bullet(slide, value, x,y,w, accent=C.blue){ rect(slide,x,y+8,7,7,accent,accent,true); text(slide,value,x+20,y,w-20,34,18,{color:C.ink}); }
function block(slide, heading, body, x,y,w,h,color=C.blue){rect(slide,x,y,w,h,C.white,C.line,true);rect(slide,x,y,w,7,color,color,true);text(slide,heading,x+18,y+22,w-36,30,20,{bold:true,color:C.navy});text(slide,body,x+18,y+60,w-36,h-72,15,{color:C.gray});}
function arrow(slide,x,y,w,h,color=C.blue){const a=slide.shapes.add({geometry:"rightArrow",position:{left:x,top:y,width:w,height:h},fill:color,line:{fill:color,width:0}});return a;}
function note(slide, value){ slide.speakerNotes.textFrame.setText(value); }

// 1: Cover
{
 const s=ppt.slides.add(); s.background.fill=C.navy;
 rect(s,0,0,22,720,C.teal,C.teal); rect(s,70,100,110,6,C.teal,C.teal);
 text(s,"Hybrid Cloud Architecture Design",70,154,1000,72,42,{bold:true,color:C.white});
 text(s,"for a Scalable College Application",70,232,960,62,40,{bold:true,color:C.white});
 text(s,"College project presentation",72,331,450,30,19,{color:"#BFD9EC"});
 text(s,"Public Cloud  ·  Private Cloud  ·  Secure Hybrid Connection",72,505,900,28,17,{color:"#BFD9EC"});
 text(s,"Admission | Course Registration | E-Learning | Academic Records | Finance",72,545,950,25,16,{color:"#BFD9EC"});
 note(s,"Project overview presentation based on the implemented local Docker prototype.");
}

// 2: Problem and objective
{
 const s=ppt.slides.add(); title(s,"Project problem and objective","College systems need both high public availability and strong protection for sensitive records.");
 text(s,"The challenge",70,185,310,30,22,{bold:true,color:C.navy});
 bullet(s,"Admission deadlines and result publication create sudden spikes in student traffic.",70,230,520,C.gold);
 bullet(s,"Academic marks and financial transactions require restricted access.",70,300,500,C.purple);
 bullet(s,"One system must connect both workloads without exposing the private database.",70,370,500,C.teal);
 rect(s,680,195,460,280,C.pale,C.pale,true); label(s,"PROJECT OBJECTIVE",715,225,150,C.blue);
 text(s,"Build a working college portal that separates public and private workloads, authenticates users with JWT, and demonstrates load balancing with cloud bursting.",715,276,365,135,25,{bold:true,color:C.navy});
 text(s,"Focus: a clear architecture that can be demonstrated during project evaluation.",715,430,350,40,15,{color:C.gray}); footer(s,2); note(s,"No external deployment claim: the project models the architecture locally using Docker networks.");
}

// 3 modules
{
 const s=ppt.slides.add(); title(s,"Application modules","The prototype keeps the scope realistic while covering the core college workflows.");
 const items=[
  ["Admission portal","Applicants submit programme and qualification details",C.blue],
  ["Course registration","Students register for available courses",C.blue],
  ["E-learning","Course materials remain available during peak usage",C.blue],
  ["Academic records","Marks, grades and semesters stay private",C.purple],
  ["Financial records","Fees, payments and scholarship entries stay private",C.purple],
  ["Admin monitoring","Administrators inspect requests, health and capacity",C.teal]
 ];
 items.forEach((it,i)=>{const col=i%3,row=Math.floor(i/3);block(s,it[0],it[1],70+col*380,190+row*210,335,165,it[2]);});
 footer(s,3); note(s,"Implemented modules mirror the public-cloud and private-cloud workload separation described in the project abstract.");
}

// 4 architecture
{
 const s=ppt.slides.add(); title(s,"Hybrid cloud architecture","Nginx exposes only the public entry point. Private services and data remain on internal networks.");
 label(s,"STUDENTS / STAFF",75,205,150,C.blue); arrow(s,235,207,75,22,C.blue); label(s,"NGINX",325,205,100,C.blue); text(s,"Load balancer + reverse proxy",300,239,155,26,13,{color:C.gray,align:"center"});
 arrow(s,455,207,75,22,C.blue); label(s,"PUBLIC API",545,205,135,C.blue); text(s,"JWT, admission, courses, materials",515,239,205,26,13,{color:C.gray,align:"center"});
 arrow(s,720,207,75,22,C.teal); label(s,"HYBRID NETWORK",810,205,155,C.teal); text(s,"Authenticated service connection",785,239,210,26,13,{color:C.gray,align:"center"});
 arrow(s,985,207,65,22,C.purple); label(s,"PRIVATE API",1065,205,130,C.purple);
 rect(s,535,348,180,150,C.pale,C.line,true); text(s,"Public database",560,375,135,27,20,{bold:true,color:C.navy,align:"center"}); text(s,"Students\nAdmissions\nCourses\nMaterials",565,415,125,78,15,{color:C.gray,align:"center"});
 rect(s,1010,348,180,150,C.lightPurple,C.line,true); text(s,"Private database",1030,375,145,27,20,{bold:true,color:C.navy,align:"center"}); text(s,"Academic records\nFinancial records",1030,425,145,55,15,{color:C.gray,align:"center"});
 arrow(s,630,277,16,62,C.blue); arrow(s,1120,277,16,62,C.purple);
 text(s,"Public cloud",535,542,180,25,20,{bold:true,color:C.blue,align:"center"}); text(s,"Private cloud",1010,542,180,25,20,{bold:true,color:C.purple,align:"center"});
 text(s,"The browser never receives a direct route to the private API or private database.",300,605,680,32,18,{bold:true,color:C.green,align:"center"}); footer(s,4); note(s,"Architecture reflects the Compose topology: proxy on public network, public API bridging the internal hybrid network, and private DB on a separate internal network.");
}

// 5 workload separation
{
 const s=ppt.slides.add(); title(s,"Public and private workload separation","Each component sits in the environment that matches its traffic profile and sensitivity.");
 rect(s,70,185,510,400,"#E9F5FF","#B9DAF4",true); label(s,"PUBLIC CLOUD",100,215,130,C.blue); text(s,"High-traffic student services",100,265,360,38,28,{bold:true,color:C.navy});
 bullet(s,"Admission applications",105,325,320,C.blue); bullet(s,"Course registration",105,375,320,C.blue); bullet(s,"E-learning materials",105,425,320,C.blue); bullet(s,"Authentication and API gateway",105,475,350,C.blue);
 rect(s,700,185,510,400,"#F2EEFF","#D6C8FF",true); label(s,"PRIVATE CLOUD",730,215,135,C.purple); text(s,"Sensitive institutional data",730,265,360,38,28,{bold:true,color:C.navy});
 bullet(s,"Academic marks and grades",735,325,350,C.purple); bullet(s,"Financial transactions",735,375,350,C.purple); bullet(s,"Private service API",735,425,350,C.purple); bullet(s,"Private PostgreSQL database",735,475,350,C.purple);
 footer(s,5); note(s,"The public API accesses private data only through the simulated hybrid-cloud connection.");
}

// 6 security
{
 const s=ppt.slides.add(); title(s,"Secure API access","JWT validates the student at the public edge. A separate short-lived token protects the internal private request.");
 const steps=[
  ["1", "Sign in", "Student sends credentials to the public API", C.blue],
  ["2", "User JWT", "Public API returns a JWT with user ID and role", C.blue],
  ["3", "Gateway check", "Public API validates JWT and creates a 60-second internal token", C.teal],
  ["4", "Private check", "Private API verifies service purpose and record ownership", C.purple],
  ["5", "Authorized data", "Academic or finance records return through the gateway", C.green],
 ];
 steps.forEach((a,i)=>{const x=70+i*230;rect(s,x,230,190,250,C.white,C.line,true);rect(s,x+65,200,60,60,a[3],a[3],true);text(s,a[0],x+65,213,60,32,23,{bold:true,color:C.white,align:"center"});text(s,a[1],x+18,292,154,28,18,{bold:true,color:C.navy,align:"center"});text(s,a[2],x+18,334,154,88,14,{color:C.gray,align:"center"});if(i<4)arrow(s,x+195,313,27,18,C.line);});
 text(s,"Student ownership rule: students can request only their own private records.",240,555,800,30,19,{bold:true,color:C.green,align:"center"});footer(s,6);note(s,"The private API rejects ordinary browser calls because it requires X-Hybrid-Service-Token signed with the internal service secret.");
}

// 7 data and container topology
{
 const s=ppt.slides.add(); title(s,"Data design and container topology","Two PostgreSQL databases support independent public and private data boundaries.");
 block(s,"Public database","students\nadmissions\ncourses\nregistrations\nmaterials",100,205,330,300,C.blue);
 block(s,"Private database","academic_records\nfinancial_records\n\nStudent ID works as a logical link between stores.",850,205,330,300,C.purple);
 arrow(s,455,305,120,32,C.teal); text(s,"No direct database connection",470,352,180,42,15,{bold:true,color:C.teal,align:"center"}); arrow(s,700,305,120,32,C.teal);
 text(s,"Public API",520,270,150,25,19,{bold:true,color:C.navy,align:"center"}); text(s,"Private API",615,270,150,25,19,{bold:true,color:C.navy,align:"center"});
 text(s,"Docker networks model the deployment boundaries",70,570,440,30,22,{bold:true,color:C.navy});
 text(s,"public_net serves proxy and public API\nhybrid_net carries controlled service-to-service traffic\nprivate_net holds the private API and database",70,615,560,58,16,{color:C.gray});
 footer(s,7);note(s,"The schema intentionally avoids a cross-database foreign key because the public and private stores represent separate environments.");
}

// 8 scaling
{
 const s=ppt.slides.add(); title(s,"Load balancing and cloud bursting","The public API can scale horizontally behind Nginx when student traffic increases.");
 text(s,"Normal demand",140,190,300,34,25,{bold:true,color:C.navy,align:"center"}); label(s,"NGINX",225,245,110,C.blue); arrow(s,262,285,35,55,C.blue); label(s,"PUBLIC API × 1",190,355,185,C.blue);
 text(s,"Peak demand",780,190,300,34,25,{bold:true,color:C.navy,align:"center"}); label(s,"NGINX",865,245,110,C.blue); arrow(s,912,285,35,38,C.blue); arrow(s,780,335,75,18,C.blue); arrow(s,912,335,35,18,C.blue); arrow(s,970,335,75,18,C.blue); label(s,"API 1",765,385,100,C.blue);label(s,"API 2",890,385,100,C.blue);label(s,"API 3",1015,385,100,C.blue);
 rect(s,130,510,1020,90,C.pale,C.pale,true);text(s,"Demo command:  docker compose up -d --scale public-api=3",185,535,760,26,22,{bold:true,color:C.navy,align:"center"});
 text(s,"The load-test script reports request latency and shows which public replicas handled requests.",200,625,700,26,16,{color:C.gray,align:"center"});footer(s,8);note(s,"Compose scaling is a deterministic local cloud-bursting demonstration. Production systems would use metric-driven autoscaling.");
}

// 9 testing/demo
{
 const s=ppt.slides.add(); title(s,"Demonstration and validation","The working prototype supports a clear project-evaluation sequence.");
 const rows=[
  ["Student login","JWT returned for the demo student account","Authenticated public access"],
  ["Public service request","Materials and course list requested through Nginx","Load-balanced public workload"],
  ["Private record request","Academic and finance APIs called through the gateway","Protected private workload"],
  ["Admin dashboard","Admin observes request counts, status and configured replicas","Centralized monitoring"],
  ["Load test","Concurrent requests run before and after scaling replicas","Cloud-bursting simulation"]
 ];
 const table=s.tables.add({left:70,top:190,width:1140,height:350,columns:3,rows:rows.length+1,columnWidths:[250,470,420],values:[["Demo step","What the evaluator sees","Concept demonstrated"],...rows]});
 table.styleOptions={headerRow:true,bandedRows:true};
 table.borders.assign({style:"solid",fill:C.line,width:1});
 table.cells.block({row:0,column:0,rowCount:1,columnCount:3}).assign({fill:C.navy,textStyle:{typeface:font,fontSize:17,bold:true,color:C.white}});
 table.cells.block({row:1,column:0,rowCount:rows.length,columnCount:3}).assign({textStyle:{typeface:font,fontSize:15,color:C.ink}});
 text(s,"Live endpoint: http://localhost:8080",70,585,500,28,20,{bold:true,color:C.green});text(s,"Student: student@college.edu / Student@123",70,630,520,24,15,{color:C.gray});footer(s,9);note(s,"Only local verification statements appear here. The live endpoint works when Docker Desktop runs on the demonstration machine.");
}

// 10 conclusion
{
 const s=ppt.slides.add(); title(s,"Outcomes and future work","The prototype demonstrates the hybrid-cloud design as a working college application.");
 text(s,"Project outcome",70,195,400,35,27,{bold:true,color:C.navy});
 bullet(s,"Student-facing modules operate in the scalable public cloud layer.",70,250,520,C.blue);
 bullet(s,"Academic and financial data remain in the private cloud layer.",70,315,520,C.purple);
 bullet(s,"Nginx, JWT, internal service tokens and network separation provide a clear security story.",70,380,530,C.teal);
 bullet(s,"Docker replicas and load testing demonstrate the scaling approach.",70,445,530,C.green);
 rect(s,700,210,430,290,C.pale,C.pale,true);label(s,"FUTURE ENHANCEMENTS",735,240,180,C.blue);text(s,"Deploy public services to a managed cloud platform\n\nUse mTLS, managed secrets and audit logging\n\nAdd metric-driven autoscaling and alerting",740,300,340,145,18,{color:C.ink});
 text(s,"Thank you",70,600,600,50,35,{bold:true,color:C.navy});text(s,"Questions and discussion",72,650,400,25,18,{color:C.gray});footer(s,10);note(s,"Future deployment mapping is documented, but this project does not claim a live AWS deployment.");
}

const candidatePath = path.join(TMP_DIR, "candidate.pptx");
await (await PresentationFile.exportPptx(ppt)).save(candidatePath);
const requirements={explicitTotalSlideCount:10,requiredNativeTableOwnerSlides:[9],requiredNativeChartOwnerSlides:[]};
const result=await finalizePresentation({
 ...requirements, workspaceDir, candidatePath, finalPath:FINAL_PPTX,
 pythonExecutable:"C:/Users/chitt/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
 integrityValidatorPath:path.join(SKILL_DIR,"container_tools","inspect_presentation_package_integrity.py"),
 layoutValidatorPath:path.join(SKILL_DIR,"container_tools","inspect_presentation_layout_geometry.py"),
 layoutArgs:["--expected-slide-size-emu","12192000,6858000","--validate-bullet-geometry","--validate-heading-fit","--require-native-table-slide","9"],
 requiredNativeTableOwnerSlides:[9],fontPolicy:{basis:"design",families:[font]},verifyArtifactToolImport:true,
 receiptPath:path.join(TMP_DIR,"validation.json")
});
console.log(JSON.stringify({finalPath:FINAL_PPTX, result},null,2));
