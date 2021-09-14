import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

import './BrushColorSelector.css';

let contrastColor = 'rgba(255, 255, 255, 1)'

const BrushColorSelector = ({ defaultColor, index, onNext, onPrev }) => {
  useEffect(() => {
    contrastColor = getContrastColor(defaultColor)

  }, [defaultColor]);

  return (
    <div className="dcmseg-brush-color-selector">
      <div
        className="selector-active-segment"
        style={{ backgroundColor: defaultColor, color: contrastColor }}
      >
        {index}
      </div>
      <div className="selector-buttons">
        <button onClick={onPrev}>
          Previous
          </button>
        <button onClick={onNext}>
          Next
          </button>
      </div>
    </div>
  );
};

BrushColorSelector.propTypes = {
  contrastColor: PropTypes.string,
  defaultColor: PropTypes.string.isRequired,
  index: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onNext: PropTypes.func.isRequired,
  onPrev: PropTypes.func.isRequired,
};






//returns black or with color to contrast with background color as input
//background color must be a string in rgba numerical format (no %, hex, hsl, etc..)
//some background colors defined in colorLUT use alfa value in 0-255 (why ???) so i'm easing the regex to allow a wide range of alfa values
const getContrastColor = (backgroundColor) => {
  const colorLight = 'rgba(255,255,255,1)',
    colorDark = 'rgba(0,0,0,1)'

  let match = backgroundColor.match(/rgba\((\d{1,3}),\s?(\d{1,3}),\s?(\d{1,3}),\s?((\d{1,3})|0?\.\d+)\)/i)
  console.log(match)
  if (!match) {
    //default
    return colorLight
  }

  const r = match[1], g = match[2], b = match[3]

  //method 1 - HSV perpective (only V needed here)
  // const V = (Math.max(r, g, b)) / 255
  // if (V < 0.5) {
  //   return colorLight
  // } else {
  //   return colorDark
  // }

  //method 2 - LUMA (Rec. 2020 -> https://en.wikipedia.org/wiki/HSL_and_HSV)
  const Y = (0.2627 * r) + (0.6780 * g) + (0.0593 * b)
  if (Y < 165) {
    return colorLight
  } else {
    return colorDark
  }
}



export default BrushColorSelector;
