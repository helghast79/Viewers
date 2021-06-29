


let imageIdsDicomWeb = JSON.parse('["dicomweb://s3.amazonaws.com/lury/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032220.11.dcm","dicomweb://s3.amazonaws.com/lury/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032220.12.dcm"]')
let imagePromisesDicomWeb = [];
for (let i = 0; i < imageIdsDicomWeb.length; i++) {
  imagePromisesDicomWeb.push(
    cornerstone.loadImage(imageIdsDicomWeb[i])
  );
}
Promise.all(imagePromisesDicomWeb).then(images => console.log(images));

let imageIdsWadors = JSON.parse('["wadors:https://server.dcmjs.org/dcm4chee-arc/aets/DCM4CHEE/rs/studies/1.3.6.1.4.1.14519.5.2.1.7311.5101.170561193612723093192571245493/series/1.3.6.1.4.1.14519.5.2.1.7311.5101.206828891270520544417996275680/instances/1.3.6.1.4.1.14519.5.2.1.7311.5101.140661212185680998225449002613/frames/1","wadors:https://server.dcmjs.org/dcm4chee-arc/aets/DCM4CHEE/rs/studies/1.3.6.1.4.1.14519.5.2.1.7311.5101.170561193612723093192571245493/series/1.3.6.1.4.1.14519.5.2.1.7311.5101.206828891270520544417996275680/instances/1.3.6.1.4.1.14519.5.2.1.7311.5101.105945183098328980140457962163/frames/1"]');
let imagePromisesWadors = [];
for (let i = 0; i < imageIdsWadors.length; i++) {
  imagePromisesWadors.push(
    cornerstone.loadImage(imageIdsWadors[i])
  );
}
Promise.all(imagePromisesWadors).then(images => console.log(images));






const { studyMetadataManager, DicomLoaderService } = OHIF.utils;
const enabledElements = cornerstone.getEnabledElements()
const element = enabledElements[0].element

const globalToolStateManager =
  cornerstoneTools.globalImageIdSpecificToolStateManager;
const toolState = globalToolStateManager.saveToolState();

const stackToolState = cornerstoneTools.getToolState(element, "stack");
const imageIds = stackToolState.data[0].imageIds;

let imagePromises = [];
for (let i = 0; i < imageIds.length; i++) {
  imagePromises.push(cornerstone.loadImage(imageIds[i]));
}

const segments = [];

const { getters } = cornerstoneTools.getModule('segmentation');
const { labelmaps3D } = getters.labelmaps3D(element);

let correctedLabelMaps3d = [];
for (let labelmapIndex = 0; labelmapIndex < labelmaps3D.length; labelmapIndex++) {
  correctedLabelMaps3d.push({
    labelmaps2D: labelmaps3D[labelmapIndex].labelmaps2D,
    metadata: labelmaps3D[labelmapIndex].metadata.data
  })
  //labelmaps3D[labelmapIndex].metadata = labelmaps3D[labelmapIndex].metadata.data
}



let imageObj;
let imagesData = [];
Promise.all(imagePromises)
  .then(async images => {
    imageObj = images;

    for (im of images) {
      const studyInstanceUID = cornerstone.metaData.get('StudyInstanceUID', im.imageId)
      const studyMetadata = studyMetadataManager.get(studyInstanceUID)
      const displaySet = studyMetadata._displaySets.filter(ds => ds.images && ds.images.length)[0]
      const studies = [studyMetadata._data]

      let data = await DicomLoaderService.findDicomDataPromise(displaySet, studies);
      imagesData.push(data)
    }

    //console.log(imagesData)

    console.log(labelmaps3D)
    const segBlob = dcmjs.adapters.Cornerstone.Segmentation.generateSegmentation(
      imagesData,
      correctedLabelMaps3d
    );

    console.log(segBlob);

  })


// let pixelData = imageObj[0].getPixelData();
// let pixelDataBuffer = pixelData.buffer;
// let allPixelData = new Uint8Array( pixelData )
// let pixelArrayBuffer = new Uint8Array( pixelData.buffer)












function arr_diff(a1, a2) {

  var a = [], diff = [];

  for (var i = 0; i < a1.length; i++) {
    a[a1[i]] = true;
  }

  for (var i = 0; i < a2.length; i++) {
    if (a[a2[i]]) {
      delete a[a2[i]];
    } else {
      a[a2[i]] = true;
    }
  }

  for (var k in a) {
    diff.push(k);
  }

  return diff;
}




function arr_diff2(a1, a2) {

  var diff = {};

  for (var i = 0; i < a1.length; i++) {

    if (a1[i] !== a2[i]) {
      diff[i.toString()] = [a1[i], a2[i]]
    }

  }
  return diff;
}

















const enabledElements = cornerstone.getEnabledElements()
const element = enabledElements[0].element

const globalToolStateManager =
  cornerstoneTools.globalImageIdSpecificToolStateManager;
const toolState = globalToolStateManager.saveToolState();

const stackToolState = cornerstoneTools.getToolState(element, "stack");
const imageIds = stackToolState.data[0].imageIds;

const { getters, setters, state, onRegisterCallback, configuration } = cornerstoneTools.getModule('segmentation');



var activeLabelmapBuffer = getters.activeLabelmapBuffer(element);
var activeLabelmapIndex = getters.activeLabelmapIndex(element);
var activeSegmentIndex = getters.activeSegmentIndex(element, activeLabelmapIndex);
var brushColor = getters.brushColor(element);
var labelmap3D = getters.labelmap3D(element, activeLabelmapIndex);
var colorForSegmentIndexColorLUT = getters.colorForSegmentIndexColorLUT(labelmap3D, activeSegmentIndex);
var colorLUT = getters.colorLUT(labelmap3D);
var isSegmentVisible = getters.isSegmentVisible(element, activeSegmentIndex, activeLabelmapIndex);
var labelmap2D = getters.labelmap2D(element);
var labelmapBuffers = getters.labelmapBuffers(element, activeLabelmapIndex);
var labelmapStats = getters.labelmapStats(element, activeSegmentIndex, activeLabelmapIndex);
var labelmaps3D = getters.labelmaps3D(element);
var metadata = getters.metadata(element, activeLabelmapIndex, activeSegmentIndex);
var segmentOfActiveLabelmapAtEvent = getters.segmentOfActiveLabelmapAtEvent(element);
