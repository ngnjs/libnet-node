// This file provides a subset of functions
// from @ngnjs/libdata. These are only used in the
// cache system. There is no need to depend on the
// entire libdata library just for these methods.
// While this is redundant, it minimizes the build
// size and removes the only dependency developers
// would otherwise need to include.
function nullIf (sourceExpression, comparisonExpression = '') {
  try {
    // If the values aren't equal, make sure it's not due to blank values
    // or hidden characters.
    if (sourceExpression !== comparisonExpression) {
      // Different data types indicate different values.
      if (typeof sourceExpression !== typeof comparisonExpression) {
        return sourceExpression
      }

      if (typeof sourceExpression === 'string') {
        if (sourceExpression.trim() !== comparisonExpression.trim()) {
          return sourceExpression
        }
      }
    }

    return sourceExpression === comparisonExpression ? null : sourceExpression
  } catch (e) {
    throw new Error(`nullIf could not compare '${sourceExpression}' to '${comparisonExpression}'. ${e.message}`)
  }
}

function converge () {
  if (arguments.length < 2) {
    return null
  } else if (arguments.length === 2) {
    if (arguments[1] === undefined) {
      return null
    } else if (arguments[0] === true) {
      return nullIf(arguments[1])
    } else {
      return arguments[1]
    }
  }

  for (let i = 1; i < arguments.length; i++) {
    if (arguments[i] !== undefined &&
      (arguments[0] ? nullIf(arguments[i]) : arguments[i]) !== null
    ) {
      return arguments[i]
    }
  }

  return null
}

export function coalesce () { return converge(false, ...arguments) }

function coalesceb () { return converge(true, ...arguments) }

function typeOf (el) {
  if (el === undefined) {
    return 'undefined'
  }

  if (el === null) {
    return 'null'
  }

  const value = Object.prototype.toString.call(el).split(' ')[1].replace(/[^A-Za-z]/gi, '').toLowerCase()

  if (value === 'function' || typeof el === 'function') {
    if (!el.name) {
      const name = coalesceb(el.toString().replace(/\n/gi, '').replace(/^function\s|\(.*$/mgi, '').toLowerCase(), 'function')

      if (name.indexOf(' ') >= 0) {
        return 'function'
      }

      return name.toLowerCase()
    }

    return coalesceb(el.name, 'function').toLowerCase()
  }

  return value.toLowerCase()
}

export function forceNumber (value, radix = null) {
  try {
    switch (typeOf(value)) {
      case 'boolean':
        return value ? 1 : 0

      case 'number':
        return value

      case 'date':
        return value.getTime()

      case 'string':
        return radix !== null ? parseInt(value, radix) : parseFloat(value)

      default:
        return NaN
    }
  } catch (e) {
    return NaN
  }
}
