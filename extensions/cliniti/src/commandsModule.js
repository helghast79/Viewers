//import cornerstone from 'cornerstone-core';
//import cornerstoneTools from 'cornerstone-tools';
import OHIF from '@ohif/core';
//import dcmjs from './dcmjs_debug';
//import dcmjs from 'dcmjs';
//import dicomParser from 'dicom-parser';

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

    console.log('~~ GOOFY');

  },
  // requestNewSegmentation: async ({ viewports }) => {
  //   const allViewports = Object.values(viewports.viewportSpecificData);
  //   const promises = allViewports.map(async (viewport, viewportIndex) => {
  //     let api = apis[viewportIndex];

  //     if (!api) {
  //       api = await _getActiveViewportVTKApi(viewports);
  //       apis[viewportIndex] = api;
  //     }

  //     api.requestNewSegmentation();
  //     api.updateImage();
  //   });
  //   await Promise.all(promises);
  // },
  // jumpToSlice: async ({
  //   viewports,
  //   studies,
  //   StudyInstanceUID,
  //   displaySetInstanceUID,
  //   SOPClassUID,
  //   SOPInstanceUID,
  //   segmentNumber,
  //   frameIndex,
  //   frame,
  //   done = () => { },
  // }) => {
  //   let api = apis[viewports.activeViewportIndex];

  //   if (!api) {
  //     api = await _getActiveViewportVTKApi(viewports);
  //     apis[viewports.activeViewportIndex] = api;
  //   }

  //   const stack = OHIFVTKViewport.getCornerstoneStack(
  //     studies,
  //     StudyInstanceUID,
  //     displaySetInstanceUID,
  //     SOPClassUID,
  //     SOPInstanceUID,
  //     frameIndex
  //   );

  //   const imageDataObject = getImageData(
  //     stack.imageIds,
  //     displaySetInstanceUID
  //   );

  //   let pixelIndex = 0;
  //   let x = 0;
  //   let y = 0;
  //   let count = 0;

  //   const rows = imageDataObject.dimensions[1];
  //   const cols = imageDataObject.dimensions[0];

  //   for (let j = 0; j < rows; j++) {
  //     for (let i = 0; i < cols; i++) {
  //       // [i, j] =
  //       const pixel = frame.pixelData[pixelIndex];
  //       if (pixel === segmentNumber) {
  //         x += i;
  //         y += j;
  //         count++;
  //       }
  //       pixelIndex++;
  //     }
  //   }
  //   x /= count;
  //   y /= count;

  //   const position = [x, y, frameIndex];
  //   const worldPos = _convertModelToWorldSpace(
  //     position,
  //     imageDataObject.vtkImageData
  //   );

  //   api.svgWidgets.rotatableCrosshairsWidget.moveCrosshairs(worldPos, apis);
  //   done();
  // },
};

const definitions = {
  doGoofyStuff: {
    commandFn: actions.doGoofyStuff,
    storeContexts: [],
    // options: { rotation: 90 },
  },
  // requestNewSegmentation: {
  //   commandFn: actions.requestNewSegmentation,
  //   storeContexts: ['viewports'],
  //   options: {},
  // },
  // jumpToSlice: {
  //   commandFn: actions.jumpToSlice,
  //   storeContexts: ['viewports'],
  //   options: {},
  // },
};

export default {
  actions,
  definitions,
  defaultContext: 'ACTIVE_VIEWPORT::CORNERSTONE',
};
