import { Viewer } from "./viewer";

const viewer = new Viewer();

viewer.init();

viewer.renderLoop();

viewer.addDemo();
// viewer.addLAZ("http://localhost:5173/copc.copc.laz");
viewer.addLAZ("http://localhost:5173/lion_takanawa.copc.laz");
viewer.addLAZ("http://localhost:5173/autzen-classified.copc.laz");

// viewer.addLAZ("https://s3.amazonaws.com/hobu-lidar/sofi.copc.laz");
// viewer.addLAZ("https://s3.amazonaws.com/data.entwine.io/millsite.copc.laz");
// viewer.addLAZ("http://localhost:5173/sofi.copc.laz");
// viewer.addLAZ("http://localhost:5173/millsite.copc.laz");
