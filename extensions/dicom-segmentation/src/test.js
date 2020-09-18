


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
  normalizedLabelMaps3d.push({
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
