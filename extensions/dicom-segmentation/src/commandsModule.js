import cornerstone from 'cornerstone-core';
import cornerstoneTools from 'cornerstone-tools';
import OHIF from '@ohif/core';
//import dcmjs from './dcmjs_debug';
import dcmjs from 'dcmjs';
import dicomParser from 'dicom-parser';

// import setCornerstoneLayout from './utils/setCornerstoneLayout.js';
// import { getEnabledElement } from './state';
// import CornerstoneViewportDownloadForm from './CornerstoneViewportDownloadForm';
// const scroll = cornerstoneTools.import('util/scroll');

const { studyMetadataManager, DicomLoaderService } = OHIF.utils;
const { setViewportSpecificData } = OHIF.redux.actions;


// "actions" doesn't really mean anything
// these are basically ambigous sets of implementation(s)
const actions = {
  doGoofyStuff: async () => {

    //create the segmentation blob with the labelmaps3D from cornerstone
    const segBlob = createSeg()




    //not in brush
    // let toolState = cornerstoneTools.getToolState(
    //   element,
    //   cornerstoneTools[`BrushTool`].getReferencedToolDataName
    // );

    //imageId is unique for each instance
    // const imageId = enabledElements[0].image.imageId;
    // //intance showing on screen
    // const instance = cornerstone.metaData.get('instance', imageId);

    // const { state, getters, setters } = cornerstoneTools.getModule('segmentation');
    // const brushStackState = state.series[imageId];

    // const colorLUTIndex = _getNextColorLUTIndex()
    // const labelmapIndex = _getNextLabelmapIndex(imageId);

    // console.log(colorLUTIndex, brushStackState, labelmapIndex)


    console.log('~~ GOOFY');

  },
};

const definitions = {
  doGoofyStuff: {
    commandFn: actions.doGoofyStuff,
    storeContexts: [],
    // options: { rotation: 90 },
  },
};

export default {
  actions,
  definitions,
  defaultContext: 'ACTIVE_VIEWPORT::CORNERSTONE',
};





// function _getNextColorLUTIndex() {
//   const { state } = cornerstoneTools.getModule('segmentation');
//   const { colorLutTables } = state;

//   let colorLUTIndex = colorLutTables.length;

//   for (let i = 0; i < colorLutTables.length; i++) {
//     if (!colorLutTables[i]) {
//       colorLUTIndex = i;
//       break;
//     }
//   }

//   return colorLUTIndex;
// }



// function _getNextLabelmapIndex(firstImageId) {
//   const { state } = cornerstoneTools.getModule('segmentation');
//   const brushStackState = state.series[firstImageId];

//   let labelmapIndex = 0;

//   if (brushStackState) {
//     const { labelmaps3D } = brushStackState;
//     labelmapIndex = labelmaps3D.length;

//     for (let i = 0; i < labelmaps3D.length; i++) {
//       if (!labelmaps3D[i]) {
//         labelmapIndex = i;
//         break;
//       }
//     }
//   }

//   return labelmapIndex;
// }








function createSeg() {
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

  const { getters } = cornerstoneTools.getModule('segmentation');
  const { labelmaps3D } = getters.labelmaps3D(element);

  if (!labelmaps3D) {
    console.log('no labelmap3d')
    return null;
  }


  let correctedLabelMaps3d = [];
  for (let labelmapIndex = 0; labelmapIndex < labelmaps3D.length; labelmapIndex++) {

    let labelMap3d = {
      labelmaps2D: labelmaps3D[labelmapIndex].labelmaps2D,
      metadata: labelmaps3D[labelmapIndex].metadata.data
    };


    //this step is unecessary once all labelMap2d's are properly set with metadata
    labelMap3d.labelmaps2D.forEach(labelMap2d => {

      labelMap2d.segmentsOnLabelmap.forEach(segIndex => {

        //mock metadata for segments with no metadata specified (required by dcmjs)
        if (segIndex !== 0 && !labelMap3d.metadata[segIndex]) {

          labelMap3d.metadata[segIndex] = {
            RecommendedDisplayCIELabValue: dcmjs.data.Colors.rgb2DICOMLAB([
              1,
              0,
              0
            ]),
            SegmentedPropertyCategoryCodeSequence: {
              CodeValue: "T-D0050",
              CodingSchemeDesignator: "SRT",
              CodeMeaning: "Tissue"
            },
            SegmentNumber: segIndex.toString(),
            SegmentLabel: "Tissue " + segIndex.toString(),
            SegmentAlgorithmType: "SEMIAUTOMATIC",
            SegmentAlgorithmName: "Slicer Prototype",
            SegmentedPropertyTypeCodeSequence: {
              CodeValue: "T-D0050",
              CodingSchemeDesignator: "SRT",
              CodeMeaning: "Tissue"
            }
          }

        }

      })
    })

    correctedLabelMaps3d.push(labelMap3d)
  }


  Promise.all(imagePromises)
    .then(async images => {

      const studyInstanceUID = cornerstone.metaData.get('StudyInstanceUID', images[0].imageId)
      const studyMetadata = studyMetadataManager.get(studyInstanceUID)
      const displaySet = studyMetadata._displaySets.filter(ds => ds.images && ds.images.length)[0]
      const studies = [studyMetadata._data]
      //load the dicom raw data with DicomLoaderService
      const arrayBuffer = await DicomLoaderService.findDicomDataPromise(displaySet, studies);
      const byteArray = new Uint8Array(arrayBuffer);
      //use dicomParser to get a dataset object
      const dataset = dicomParser.parseDicom(byteArray, { untilTag: '' });

      //set the missing data property in all images
      images = images.map(image => ({ ...image, data: dataset }))

      //use dcmj segmentation class to generate segmentation in dicom-seg format
      const segBlob = dcmjs.adapters.Cornerstone.Segmentation.generateSegmentation(
        images,
        correctedLabelMaps3d
      );

      //now download the blob
      window.open(URL.createObjectURL(segBlob))
      //or send it to pacs server with axios for example
      //const response = await axios.post(....)


      //Create a URL for the binary.
      var objectUrl = URL.createObjectURL(segBlob)
      //for now download the file
      window.open(objectUrl)

      //return segBlob
    })
    .catch(err => {
      console.log(err)
      //return null;
    });
}







// function readFile(url) {

//   return new Promise(resolve => {

//     var oReq = new XMLHttpRequest();
//     oReq.open("GET", url, true);
//     oReq.responseType = "arraybuffer";

//     oReq.onload = function (oEvent) {
//       var arrayBuffer = oReq.response; // Note: not oReq.responseText
//       resolve(arrayBuffer)
//       // if (arrayBuffer) {
//       //   var byteArray = new Uint8Array(arrayBuffer);
//       //   resolve(byteArray)
//       // }
//     };

//     oReq.send(null);
//   })
// }
