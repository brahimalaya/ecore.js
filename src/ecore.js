//     Ecore.js 0.3.0
//     Ecore Implementation in JavaScript.
//
//     © 2012 Guillaume Hillairet.
//     EPL License (http://www.eclipse.org/legal/epl-v10.html)

(function() {

// The root object, `window` in the browser, or `global` on the server.
var root = this;

// Load underscore from the `window` object in the browser or via the require function
// on the server.
var _ = root._ || require('underscore');

// Ecore
// -------

// Base object providing common methods for the creation of model elements such as
// `EPackage`, `EClass`, `EDataType`, `EAttribute` and `EReference`. As well as the
// method `create` for the creation of domain objects, `EObject`, from a predefined
// `EClass`.

var Ecore = {

    // Returns an instance of the given EClass.
    //
    // The resulting object is an EObject having it's properties
    // initialized from the structural features of the EClass.
    //
    // Example:
    //
    //      var User = Ecore.EClass.create({
    //          name: 'User',
    //          eStructuralFeatures: [
    //              {
    //                  eClass: Ecore.EAttribute,
    //                  name: 'userName',
    //                  eType: Ecore.EcorePackage.EString
    //              }
    //          ]
    //      });
    //
    //      var u1 = Ecore.create(User);
    //      u1.set('userName', 'Randy');
    //
    //      alternatively
    //
    //      var u1 = User.create({ userName: 'Randy' });
    //
    //      u1.get('userName'); -> Randy

    create: function(eClass, attributes) {
        var attrs,
            eObject;

        if (!attributes) {
            if (eClass instanceof EObject) {
                attrs = {};
                attrs.eClass = eClass;
            } else {
                attrs = eClass;
            }
        } else {
            attrs = attributes;
            attrs.eClass = eClass;
        }

        if (!attrs.eClass || attrs.eClass.get('abstract')) {
            throw new Error('Cannot create EObject from undefined or abstract EClass');
        }

        eObject = new EObject( attrs );

        return eObject;
    }

};

// Current version
Ecore.version = '0.3.0';

// Export Ecore
if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
        exports = module.exports = Ecore;
    }
    exports.Ecore = Ecore;
} else {
    root.Ecore = Ecore;
}

var Events = {

    on: function(events, callback, context) {
        var calls, event, list;
        if (!callback) return this;

        events = events.split(/\s+/);
        calls = this._callbacks || (this._callbacks = {});

        while(event = events.shift()) {
            list = calls[event] || (calls[event] = []);
            list.push(callback, context);
        }

        return this;
    },

    off: function(events, callback, context) {
        var event, calls, list, i;

        if (!(calls = this._callbacks)) return this;
        if (!(events || callback || context)) {
            delete this._callbacks;
            return this;
        }

        events = events ? events.split(/\s+/) : _.keys(calls);
        while (event = events.shift()) {
            if (!(list = calls[event]) || !(callback || context)) {
                delete calls[event];
                continue;
            }

            for (i = list.length - 2; i >= 0; i -= 2) {
                if (!(callback && list[i] !== callback || context && list[i + 1] !== context)) {
                    list.splice(i, 2);
                }
            }
        }

        return this;
    },

    trigger: function(events) {
        var event, calls, list, i, length, args, all, rest;
        if (!(calls = this._callbacks)) return this;

        rest = [];
        events = events.split(/\s+/);
        for (i = 1, length = arguments.length; i < length; i++) {
            rest[i - 1] = arguments[i];
        }
        // For each event, walk through the list of callbacks twice, first to
        // trigger the event, then to trigger any `"all"` callbacks.
        while (event = events.shift()) {
            if (all = calls.all) all = all.slice();
            if (list = calls[event]) list = list.slice();

            if (list) {
                for (i = 0, length = list.length; i < length; i += 2) {
                    list[i].apply(list[i + 1] || this, rest);
                }
            }
            // Execute "all" callbacks.
            if (all) {
                args = [event].concat(rest);
                for (i = 0, length = all.length; i < length; i += 2) {
                    all[i].apply(all[i + 1] || this, args);
                }
            }
        }

        return this;
    }
};

// EObject
//
// Implementation of EObject. The constructor takes as parameter a hash
// containing values to be set. Values must be defined accordingly to the
// eClass features.
//

var EObject = function(attributes) {
    if (!attributes) attributes = {};

    this.eClass = attributes.eClass;
    this.values = {};

    // stores function for eOperations.
    attributes._ && (this._ = attributes._);

    // Initialize values according to the eClass features.
    initValues(this);
    setValues(this, attributes);
    initOperations(this);

    return this;
};

function initValues(eObject) {
    var eClass = eObject.eClass;
    if (!eClass) return;

    var eStructuralFeatures = eClass.get('eAllStructuralFeatures');

    _.each(eStructuralFeatures, function( eFeature ) {
        var featureName = eFeature.get('name');
        if (featureName) {
            var defaultValue = eFeature.values.defaultValue,
                upperBound = eFeature.get('upperBound'),
                isDerived = eFeature.values.derived === true,
                isContainment = eFeature.values.containment === true,
                value = eObject.values[featureName];

            if (value === null || value === undefined) {
                if (isDerived) {
                    eObject.values[featureName] = eFeature.values._;
                } else if (upperBound === 1 || !upperBound) {
                    initValue(eObject, featureName, defaultValue);
                } else {
                    if (value instanceof Ecore.EList) {
                        value._setFeature(eFeature);
                    } else {
                        eObject.values[featureName] =
                            eFeature.isTypeOf('EAttribute') ? [] :
                                new Ecore.EList(eObject, eFeature);
                    }
                }
            }
        }
    });
}

function initValue(eObject, featureName, defaultValue) {
    var _default;
    if (defaultValue === null || defaultValue === undefined) {
        _default = null;
    } else {
        if (defaultValue === 0) {
            _default = 0;
        } else if (defaultValue === false) {
            _default = false;
        } else {
            _default = defaultValue;
        }
    }
    eObject.values[featureName] = _default;
}

function getEStructuralFeature(eClass, featureName) {
    return _.find(eClass.get('eAllStructuralFeatures'), function(feature) {
        return feature.values.name === featureName;
    });
}

function setValues(eObject, attributes) {
    if (!eObject.eClass) return;

    _.each(attributes, function(value, key) {
        var eFeature = getEStructuralFeature(this.eClass, key),
            values = [];

        if (eFeature) {

            if (eFeature.isTypeOf('EReference')) {
                if (_.isArray(value)) {
                    _.each(value, function(v) {
                        values.push(v instanceof EObject ? v : Ecore.create(v));
                    });
                } else if (!value instanceof EObject) {
                    value = Ecore.create(value);
                }
            }

            if (eFeature.get('upperBound') === 1 || !eFeature.get('upperBound')) {
                this.set(key, value);
            } else {
                this.get(key).addAll(values);
            }
        }
    }, eObject);
}

function eAllOperations(eClass) {
    var eOperations = eClass.get('eOperations').array();
    var superTypes = eClass.get('eAllSuperTypes');
    var all = _.flatten(_.union(eOperations || [], _.map(superTypes || [],
                    function(s) { return eAllOperations(s); })));

    return all;
}

function initOperations(eObject) {
    if (!eObject || !eObject.eClass) return;

    var eOperations = eAllOperations(eObject.eClass);
    if (!eOperations) return;

    _.each(eOperations, function(op) {
        eObject[op.get('name')] = op._;
    });
}


// EObjectPrototype
//
// Prototype object for EObject and EModelElements.

Ecore.EObjectPrototype = {

    setEClass: function(eClass) {
        this.eClass = eClass;
        initValues(this);
        setValues(this, this.values);
        initOperations(this);

        return this;
    },

    create: function(attributes) {
        if (this.eClass.get('name') !== 'EClass') return;

        return Ecore.create(this, attributes);
    },

    // Returns true if property if a feature of the EObject.
    //
    //      @method has
    //      @param {String} name
    //      @return {Boolean}

    has: function(name) {
        return this.values.hasOwnProperty(name) || getEStructuralFeature(this.eClass, name);
    },

    // Returns true if property has its value set.
    //
    //      @method isSet
    //      @param {String} name
    //      @return {Boolean}

    isSet: function(name) {
        if (!this.has(name)) return false;

        var eClass = this.eClass;
        if (!eClass) return false;

        var value = this.get(name);
        if (value instanceof EList) {
            return value.size() > 0;
        } else {
            return value !== null && typeof value !== 'undefined';
        }
    },

    // Setter for the property identified by the first parameter.
    //
    //      @method set
    //      @param {String} name
    //      @param {Object} value
    //      @return {EObject}

    set: function(attrs, options) {
        var attr, key, val, eve;
        if (attrs === null) return this;

        // Handle attrs is a hash or attrs is
        // property and options the value to be set.
        if (!_.isObject(attrs)) {
            key = attrs;
            (attrs = {})[key] = options;
            options = arguments[2];
        }

        for (attr in attrs) {
            val = attrs[attr];
            if (typeof val !== 'undefined' && this.has(attr)) {
                this.values[attr] = val;
                eve = 'change:' + attr;
                this.trigger('change ' + eve, attr);
            }
        }

        return this;
    },

    // Getter for the property identified by the first parameter.
    //
    //      @method get
    //      @param {EStructuralFeature} feature
    //      or
    //      @param {String} feature name
    //      @return {Object}

    get: function(feature) {
        if (!feature) return null;

        var featureName = feature.eClass ? feature.get('name') : feature;
        var value = this.values[featureName];

        if (typeof value === 'function') {
            return value.apply(this);
        } else {
            return value;
        }
    },

    // Returns true if the EObject is a direct instance of the EClass.
    //
    //      @method isTypeOf
    //      @param {String} type
    //      @return {Boolean}

    isTypeOf: function(type) {
        if (!type || !this.eClass) return false;

        var typeName = type.eClass ? type.get('name') : type;

        return this.eClass.get('name') === typeName;
    },

    // Returns true if the EObject is an direct instance of the EClass or
    // if it is part of the class hierarchy.
    //
    //      @method isKindOf
    //      @param {String}
    //      @return {Boolean}

    isKindOf: function(type) {
        if(!type || !this.eClass) return false;
        if (this.isTypeOf(type)) return true;

        var typeName = type.eClass ? type.get('name') : type,
            superTypes = this.eClass.get('eAllSuperTypes');

        return _.any(superTypes, function(eSuper) {
            return eSuper.get('name') === typeName;
        });
    },

    // Returns the Resource containing the EObject.
    //
    //      @method eResource
    //      @return {Resource}

    eResource: function() {
        if (this.isKindOf('Resource')) return this;
        if (!this.eContainer) return null;
        if (this.eContainer.isKindOf('Resource')) return this.eContainer;

        return this.eContainer.eResource();
    },

    // Returns the content of an EObject.
    //
    //      @method eContents
    //      @return {Array}

    eContents: function() {
        if (!this.eClass) return [];

        var eAllFeatures = this.eClass.get('eAllStructuralFeatures'),
            eContainments = _.filter(eAllFeatures, function(feature) {
                return feature.isTypeOf('EReference') &&
                    feature.get('containment') &&
                    this.isSet(feature.get('name'));
            }, this);

        return _.flatten(_.map(eContainments, function(c) {
            var value = this.get(c.get('name'));
            return value instanceof Ecore.EList ? value.array() : value;
        }, this));
    },

    // Returns the URI of the EObject.
    //
    // URI is made of the containing Resource URI and EObject
    // identifier has fragment.
    //
    //      @method eURI
    //      @return {String}
    //

    eURI: function() {
        var eModel = this.eResource(),
            current = this;

        return eModel.get('uri') + '#' + this.fragment();
    },

    // Returns the fragment identifier of the EObject.
    //
    //      @return {String}

    fragment: function() {
        var eContainer = this.eContainer,
            eClass = this.eClass,
            iD = eClass.get('eIDAttribute');

        // Must be at least contain in a Resource or EObject.
        if (!eContainer) return null;

        // Use ID has fragment
        if (iD) return this.get(iD.get('name'));

        // ModelElement use names
        if (this.isKindOf('EModelElement')) {
            if (!eContainer || eContainer.isKindOf('Resource')) {
                return '/';
            } else {
                return eContainer.fragment() + '/' + this.get('name');
            }
        }

        // Default fragments
        var fragment;
        if (this.eContainer.isKindOf('Resource')) {
            fragment = '/';
        } else {
            var eFeature = this.eContainingFeature;
            if (eFeature) {
                fragment = this.eContainer.fragment() + '/@' + eFeature.get('name');
                if (eFeature.get('upperBound') !== 1) {
                    var position = this.eContainer.get(eFeature.get('name')).indexOf(this);
                    fragment += '.' + position;
                }
            }
        }

        return fragment;
    }
};

_.extend(EObject.prototype, Ecore.EObjectPrototype, Events);

// EList, A List implementation.
//
//      @param {EObject} owner - the owner of the feature.
//      @param {EStructuralFeature} feature - the feature associated.

var EList = Ecore.EList = function(owner, feature) {
    this._internal = [];
    this._owner = owner;
    this._size = 0;
    this._setFeature(feature);

    return this;
};

EList.prototype = {

    //  @private

    _setFeature: function(feature) {
        if (feature) {
            this._feature = feature;
            this._isContainment = this._feature.get('containment');

            _.each(this._internal, function(e) {
                if (this._isContainment) {
                    e.eContainer = this._owner;
                    e.eContainingFeature = this._feature;
                }
            }, this);
        }
    },


    // Adds an EObject.
    //
    // @method add
    // @public
    // @param {EObject} eObject
    //

    add: function(eObject) {
        if (!eObject || !eObject instanceof EObject) return this;

        if (this._isContainment) {
            eObject.eContainingFeature = this._feature;
            eObject.eContainer = this._owner;
        }

        this._size++;
        this._internal.push(eObject);

        var eve = 'add';
        if (this._feature) eve += ':' + this._feature.get('name');
        this._owner.trigger(eve, eObject);

        return this;
    },

    // Adds an array
    //
    //      @param {EObject}
    //      @param {Array}

    addAll: function() {
        _.each(_.flatten(arguments || []), function(value) {
            this.add(value);
        }, this);

        return this;
    },

    // Removes given element from the EList
    //
    // @public
    // @param {EObject}

    remove: function(eObject) {
        this._internal = _.without(this._internal, eObject);
        this._size = this._size - 1;

        return this;
    },

    // Returns the size of the EList
    //
    //      @public
    //      @returns {Integer}

    size: function() {
        return this._size;
    },

    // Returns the elment at given index
    //
    //      @public
    //      @param {integer}
    //      @returns {EObject}

    at: function(position) {
        if (this._size < position) {
            throw new Error('Index Out Of Range');
        }
        return this._internal[position];
    },

    // Returns an Array representation of the EList
    //
    //      @returns {Array}

    array: function() {
        return this._internal;
    },

    // underscore methods.

    first: function() {
        return _.first(this._internal);
    },

    last: function() {
        return _.last(this._internal);
    },

    rest: function(index) {
        return _.rest(this._internal, index);
    },

    each: function(iterator, context) {
        return _.each(this._internal, iterator, context);
    },

    filter: function(iterator, context) {
        return _.filter(this._internal, iterator, context);
    },

    find: function(iterator, context) {
        return _.find(this._internal, iterator, context);
    },

    map: function(iterator, context) {
        return _.map(this._internal, iterator, context);
    },

    reject: function(iterator, context) {
        return _.reject(this._internal, iterator, context);
    },

    contains: function(object) {
        return _.contains(this._internal, object);
    },

    indexOf: function(object) {
        return _.indexOf(this._internal, object);
    }

};

//  Bootstrap Ecore Model.

// EClass
//  - attributes:
//      - abstract: Boolean
//      - interface: Boolean
//  - references:
//      - eStructuralFeatures: EStructuralFeature
//      - eSuperTypes: EClass
//      - eOperations: EOperation
//  - operations:
//      - isSuperTypeOf(eClass): Boolean
//      - getEStructuralFeature(feature): EStructuralFeature

var EClass = new EObject(),
    EString = new EObject(),
    EInt = new EObject(),
    EBoolean = new EObject(),
    EDouble = new EObject(),
    EDate = new EObject(),
    JSObject = new EObject(),
    EClass_abstract = new EObject(),
    EClass_interface = new EObject(),
    EClass_eStructuralFeatures = new EObject(),
    EClass_eOperations = new EObject(),
    EClass_eSuperTypes = new EObject();

EClass.eClass = EClass;
EClass.values = {
    name: 'EClass',
    abstract: false,
    'interface': false,
    eStructuralFeatures: new Ecore.EList(EClass),
    eOperations: new Ecore.EList(EClass),
    eSuperTypes: new Ecore.EList(EClass),

    // Derived Features

    eAllSuperTypes: function() {
        var superTypes, eAllSuperTypes;

        if (!this._superTypes) {
            this._superTypes = this.get('eSuperTypes')._internal || [];
            this._superTypes = _.union(this._superTypes,
                _.flatten(_.map(this._superTypes, function(eSuper) {
                    return eSuper.get('eAllSuperTypes');
                }))
            );
        }

         this.on('add:eSuperTypes', function(added) {
             delete this._superTypes;
             this._superTypes = this.get('eAllSuperTypes');
         }, this);

        return this._superTypes;
    },
    eAllSubTypes: function() {
        var eClasses, subTypes;

        eClasses = Ecore.EPackage.Registry.elements('EClass');
        subTypes = _.filter(eClasses, function(c) {
            return _.contains(c.get('eAllSuperTypes'), this);
        }, this);

        return _.isArray(subTypes) ? subTypes : [];
    },
    eReferences: function() {
        var eFeatures, eReferences;

        eFeatures = this.get('eStructuralFeatures');
        eReferences = eFeatures.filter(function(f) {
            return f.isTypeOf('EReference');
        });

        return eReferences;
    },
    eAttributes: function() {
        var eFeatures, eAttributes;

        eFeatures = this.get('eStructuralFeatures');
        eAttributes = eFeatures.filter(function(f) {
            return f.isTypeOf('EAttribute');
        });

        return eAttributes;
    },
    eIDAttribute: function() {
        var eAttributes, eID;

        eAttributes = this.get('eAllAttributes');
        eID = _.filter(eAttributes, function(a) {
            return a.get('iD') === true;
        });

        return _.isArray(eID) ? null : eID;
    },
    eAllStructuralFeatures: function() {
        var eSuperFeatures, eAllFeatures, eSuperTypes;

        eSuperTypes = this.get('eAllSuperTypes');
        if (!this._features) {
            this._features = this.get('eStructuralFeatures').array();
        }

        this.on('add:eStructuralFeatures', function(added) {
            delete this._features;
            this._features = this.get('eStructuralFeatures').array();
        }, this);

        eSuperFeatures = _.flatten(
            _.map(this._superTypes || [], function(sup) {
                return sup.get('eAllStructuralFeatures');
            })
        );

        eAllFeatures = _.union(eSuperFeatures || [], this._features);

        // Returns all or an empty array.
        return eAllFeatures;
    },
    eAllAttributes: function() {
        var superTypes, eSuperFeatures, eAllFeatures;

        superTypes = this.get('eAllSuperTypes');
        eSuperFeatures = _.flatten(
            _.map(superTypes || [], function(sup) {
                return sup.get('eAllAttributes');
            })
        );
        eAllFeatures = _.union(eSuperFeatures || [],
            _.filter(this.get('eStructuralFeatures')._internal, function(f) {
                return f.isTypeOf('EAttribute');
            })
        );

        // Returns all or an empty array.
        return _.isArray(eAllFeatures) ? eAllFeatures : [];
    },
    eAllContainments: function() {
        var superTypes, eSuperFeatures, eAllFeatures;

        superTypes = this.get('eAllSuperTypes');
        eSuperFeatures = _.flatten(
            _.map(superTypes || [], function(sup) {
                return sup.get('eAllContainments');
            })
        );

        eAllFeatures = _.union(eSuperFeatures || [],
            _.filter(this.get('eStructuralFeatures')._internal, function(f) {
                return f.isTypeOf('EReference') && f.get('containment');
            })
        );

        // Returns all or an empty array.
        return _.isArray(eAllFeatures) ? eAllFeatures : [];
    },
    eAllReferences: function() {
        var superTypes, eSuperFeatures, eAllFeatures;

        superTypes = this.get('eAllSuperTypes');
        eSuperFeatures = _.flatten(
            _.map(superTypes || [], function(sup) {
                return sup.get('eAllReferences');
            })
        );

        eAllFeatures = _.union(eSuperFeatures || [],
            _.filter(this.get('eStructuralFeatures')._internal, function(f) {
                return f.isTypeOf('EReference') && !f.get('containment');
            })
        );

        // Returns all or an empty array.
        return _.isArray(eAllFeatures) ? eAllFeatures : [];
    }

};

EClass_abstract.values = {
    name: 'abstract',
    lowerBound: 0,
    upperBound: 1,
    defaultValueLiteral: 'false',
    defaultValue: false,
    eType: EBoolean
};
EClass_interface.values = {
    name: 'interface',
    lowerBound: 0,
    upperBound: 1,
    defaultValueLiteral: 'false',
    defaultValue: false,
    eType: EBoolean
};
EClass_eStructuralFeatures.values = {
    name: 'eStructuralFeatures',
    lowerBound: 0,
    upperBound: -1,
    containment: true
};
EClass_eSuperTypes.values = {
    name: 'eSuperTypes',
    lowerBound: 0,
    upperBound: -1,
    containment: false
};
EClass_eOperations.values = {
    name: 'eOperations',
    lowerBound: 0,
    upperBound: -1,
    containment: true
};
EClass.get('eStructuralFeatures')
    .add(EClass_abstract)
    .add(EClass_interface)
    .add(EClass_eSuperTypes)
    .add(EClass_eStructuralFeatures)
    .add(EClass_eOperations);


// EClass derived features
//  - eAllStructuralFeatures
//  - eAllSuperTypes
//  - eAllSubTypes (added, not in ecore)
//  - eAllAttributes
//  - eAllContainments
//  - eAllReferences
//  - eReferences
//  - eAttributes
//  - eIDAttribute

var EClass_eAllStructuralFeatures = new EObject();
EClass_eAllStructuralFeatures.values = {
    name: 'eAllStructuralFeatures',
    lowerBound: 0,
    upperBound: -1,
    derived: true,
    containment: false,
    _: EClass.values.eAllStructuralFeatures
};
var EClass_eAllSuperTypes = new EObject();
EClass_eAllSuperTypes.values = {
    name: 'eAllSuperTypes',
    lowerBound: 0,
    upperBound: -1,
    derived: true,
    containment: false,
    _: EClass.values.eAllSuperTypes
};
var EClass_eAllSubTypes = new EObject();
EClass_eAllSubTypes.values = {
    name: 'eAllSubTypes',
    lowerBound: 0,
    upperBound: -1,
    derived: true,
    containment: false,
    _: EClass.values.eAllSubTypes
};
var EClass_eAllAttributes = new EObject();
EClass_eAllAttributes.values = {
    name: 'eAllAttributes',
    lowerBound: 0,
    upperBound: -1,
    derived: true,
    containment: false,
    _: EClass.values.eAllAttributes
};
var EClass_eAllContainments = new EObject();
EClass_eAllContainments.values = {
    name: 'eAllContainments',
    lowerBound: 0,
    upperBound: -1,
    derived: true,
    containment: false,
    _: EClass.values.eAllContainments
};
var EClass_eAllReferences = new EObject();
EClass_eAllReferences.values = {
    name: 'eAllReferences',
    lowerBound: 0,
    upperBound: -1,
    derived: true,
    containment: false,
    _: EClass.values.eAllReferences
};
var EClass_eReferences = new EObject();
EClass_eReferences.values = {
    name: 'eReferences',
    lowerBound: 0,
    upperBound: -1,
    derived: true,
    containment: false,
    _: EClass.values.eReferences
};
var EClass_eAttributes = new EObject();
EClass_eAttributes.values = {
    name: 'eAttributes',
    lowerBound: 0,
    upperBound: -1,
    derived: true,
    containment: false,
    _: EClass.values.eAttributes
};
var EClass_eIDAttribute = new EObject();
EClass_eIDAttribute.values = {
    name: 'eIDAttribute',
    lowerBound: 0,
    upperBound: 1,
    derived: true,
    containment: false,
    _: EClass.values.eIDAttribute
};

EClass.get('eStructuralFeatures')
    .add(EClass_eAllStructuralFeatures)
    .add(EClass_eAllSuperTypes)
    .add(EClass_eAllSubTypes)
    .add(EClass_eAllAttributes)
    .add(EClass_eAllReferences)
    .add(EClass_eAllContainments)
    .add(EClass_eAttributes)
    .add(EClass_eReferences)
    .add(EClass_eIDAttribute);

// EClass EOperations

EClass.getEStructuralFeature = function(feature) {
    var featureName;

    featureName = feature.eClass ? feature.get('name') : feature;

    return _.find(this.get('eAllStructuralFeatures'), function(f) {
        return f.get('name') === featureName;
    });
};

var EClass_getEStructuralFeature = new EObject();
EClass_getEStructuralFeature.values = {
    name: 'getEStructuralFeature',
    lowerBound: 0,
    upperBound: 1,
    eParameters: new Ecore.EList(this)
};
EClass_getEStructuralFeature._ = EClass.getEStructuralFeature;

EClass.get('eOperations').add(EClass_getEStructuralFeature);

// Setting feature reference for ELists.
EClass.values.eStructuralFeatures._setFeature(EClass_eStructuralFeatures);
EClass.values.eSuperTypes._setFeature(EClass_eSuperTypes);
EClass.values.eOperations._setFeature(EClass_eOperations);

// Initialize remaining EClasses

var EObjectClass = EClass.create(),
    EModelElement = EClass.create(),
    EAnnotation = EClass.create(),
    ENamedElement = EClass.create(),
    EPackage = EClass.create(),
    EClassifier = EClass.create(),
    EDataType = EClass.create(),
    EEnum = EClass.create(),
    ETypedElement = EClass.create(),
    EStructuralFeature = EClass.create(),
    EAttribute = EClass.create(),
    EReference = EClass.create(),
    EOperation = EClass.create(),
    EParameter = EClass.create(),
    EEnumLiteral = EClass.create();

// Set eClass and necessary values for EClass features.

// abstract
EClass_abstract.eClass = EAttribute;
// interface
EClass_interface.eClass = EAttribute;
// eStructuralFeatures
EClass_eStructuralFeatures.eClass = EReference;
EClass_eStructuralFeatures.values.eType = EStructuralFeature;
// eSuperTypes
EClass_eSuperTypes.eClass = EReference;
EClass_eSuperTypes.values.eType = EClass;
// eOperations
EClass_eOperations.eClass = EReference;
EClass_eOperations.values.eType = EOperation;
// eAllStructuralFeatures
EClass_eAllStructuralFeatures.eClass = EReference;
EClass_eAllStructuralFeatures.values.eType = EStructuralFeature;
// eAllSuperTypes
EClass_eAllSuperTypes.eClass = EReference;
EClass_eAllSuperTypes.values.eType = EClass;
// eAllSubTypes
EClass_eAllSubTypes.eClass = EReference;
EClass_eAllSubTypes.values.eType = EClass;
// eAllAttributes
EClass_eAllAttributes.eClass = EReference;
EClass_eAllAttributes.values.eType = EAttribute;
// eAllReferences
EClass_eAllReferences.eClass = EReference;
EClass_eAllReferences.values.eType = EReference;
// eAllContainments
EClass_eAllContainments.eClass = EReference;
EClass_eAllContainments.values.eType = EReference;
// eAttributes
EClass_eAttributes.eClass = EReference;
EClass_eAttributes.values.eType = EAttribute;
// eReferences
EClass_eReferences.eClass = EReference;
EClass_eReferences.values.eType = EReference;
// eIDAttribute
EClass_eIDAttribute.eClass = EReference;
EClass_eIDAttribute.values.eType = EAttribute;
// getEStructuralFeature
EClass_getEStructuralFeature.eClass = EOperation;
EClass_getEStructuralFeature.values.eType = EStructuralFeature;

// Set Types Hierarchy.
EModelElement.get('eSuperTypes').add(EObjectClass);
EAnnotation.get('eSuperTypes').add(EModelElement);
ENamedElement.get('eSuperTypes').add(EModelElement);
EPackage.get('eSuperTypes').add(ENamedElement);
EClassifier.get('eSuperTypes').add(ENamedElement);
EClass.get('eSuperTypes').add(EClassifier);
EDataType.get('eSuperTypes').add(EClassifier);
EEnum.get('eSuperTypes').add(EDataType);
EEnumLiteral.get('eSuperTypes').add(ENamedElement);
ETypedElement.get('eSuperTypes').add(ENamedElement);
EStructuralFeature.get('eSuperTypes').add(ETypedElement);
EAttribute.get('eSuperTypes').add(EStructuralFeature);
EReference.get('eSuperTypes').add(EStructuralFeature);
EOperation.get('eSuperTypes').add(ETypedElement);
EParameter.get('eSuperTypes').add(ETypedElement);

// ETypedElement
//  - attributes:
//      - ordered: Boolean
//      - unique: Boolean
//      - lowerBound: Integer
//      - upperBound: Integer
//      - many: Boolean
//      - required: Boolean
//  - references:
//      - eType: EClassifier

var ETypedElement_eType = new EObject(),
    ETypedElement_ordered = new EObject(),
    ETypedElement_unique = new EObject(),
    ETypedElement_lowerBound = new EObject(),
    ETypedElement_upperBound = new EObject(),
    ETypedElement_many = new EObject(),
    ETypedElement_required = new EObject();

ETypedElement_eType.eClass = EReference;
ETypedElement_eType.values = {
    name: 'eType',
    lowerBound: 0,
    upperBound: 1,
    containment: false,
    eType: EClassifier
};
ETypedElement_ordered.eClass = EAttribute;
ETypedElement_ordered.values = {
    name: 'ordered',
    lowerBound: 0,
    upperBound: 1,
    defaultValueLiteral: 'true',
    defaultValue: true,
    eType: EBoolean
};
ETypedElement_unique.eClass = EAttribute;
ETypedElement_unique.values = {
    name: 'unique',
    lowerBound: 0,
    upperBound: 1,
    defaultValueLiteral: 'true',
    defaultValue: true,
    eType: EBoolean
};
ETypedElement_lowerBound.eClass = EAttribute;
ETypedElement_lowerBound.values = {
    name: 'lowerBound',
    lowerBound: 0,
    upperBound: 1,
    defaultValueLiteral: '0',
    defaultValue: 0,
    eType: EInt
};
ETypedElement_upperBound.eClass = EAttribute;
ETypedElement_upperBound.values = {
    name: 'upperBound',
    lowerBound: 0,
    upperBound: 1,
    defaultValueLiteral: '1',
    defaultValue: 1,
    eType: EInt
};
ETypedElement_many.eClass = EAttribute;
ETypedElement_many.values = {
    name: 'many',
    lowerBound: 0,
    upperBound: 1,
    eType: EBoolean,
    derived: true,
    _: function() {
        return this.get('upperBound') !== 1;
    }
};
ETypedElement_required.eClass = EAttribute;
ETypedElement_required.values = {
    name: 'required',
    lowerBound: 0,
    upperBound: 1,
    eType: EBoolean,
    derived: true,
    _: function() {
        return this.get('lowerBound') === 1;
    }
};

ETypedElement.get('eStructuralFeatures')
    .add(ETypedElement_eType)
    .add(ETypedElement_ordered)
    .add(ETypedElement_unique)
    .add(ETypedElement_lowerBound)
    .add(ETypedElement_upperBound)
    .add(ETypedElement_many)
    .add(ETypedElement_required);

// EModelElement
//  - references:
//      - eAnnotations
//  - operations:
//      - getEAnnotation(source): EAnnotation

// ENamedElement

var ENamedElement_name = new EObject();
ENamedElement_name.eClass = EAttribute;
ENamedElement_name.values = {
    name: 'name',
    lowerBound: 0,
    upperBound: 1,
    eType: EString
};
ENamedElement.get('eStructuralFeatures').add(ENamedElement_name);

// EClassifier
//  - references:
//      - ePackages: EPackage

// EStructuralFeature
//  - attributes:
//      - changeable: Boolean
//      - volatile: Boolean
//      - transient: Boolean
//      - defaultValueLiteral: String
//      - defaultValue: Object
//      - unsettable: Boolean
//      - derived: Boolean

var EStructuralFeature_changeable = EAttribute.create({ name: 'changeable', eType: EBoolean }),
    EStructuralFeature_volatile = EAttribute.create({ name: 'volatile', eType: EBoolean }),
    EStructuralFeature_transient = EAttribute.create({ name: 'transient', eType: EBoolean }),
    EStructuralFeature_defaultValueLiteral = EAttribute.create({ name: 'defaultValueLiteral', eType: EString }),
    EStructuralFeature_defaultValue = EAttribute.create({ name: 'defaultValue', eType: JSObject, derived: true }),
    EStructuralFeature_unsettable = EAttribute.create({ name: 'unsettable', eType: EBoolean }),
    EStructuralFeature_derived = EAttribute.create({ name: 'derived', eType: EBoolean });

EStructuralFeature.get('eStructuralFeatures')
    .add(EStructuralFeature_changeable)
    .add(EStructuralFeature_volatile)
    .add(EStructuralFeature_transient)
    .add(EStructuralFeature_defaultValueLiteral)
    .add(EStructuralFeature_defaultValue)
    .add(EStructuralFeature_unsettable)
    .add(EStructuralFeature_derived);

EStructuralFeature_defaultValue.set({ derived: true });

// EReference
//  - attributes
//      - containment
//      - container
//      - resolveProxies
//  - references
//      - eOpposite

var EReference_containment = EAttribute.create({ name: 'containment', eType: EBoolean }),
    EReference_container = EAttribute.create({ name: 'container', eType: EBoolean }),
    EReference_resolveProxies = EAttribute.create({ name: 'resolveProxies', eType: EBoolean }),
    EReference_eOpposite = EReference.create({ name: 'eOpposite', eType: EReference });

EReference.get('eStructuralFeatures')
    .add(EReference_containment)
    .add(EReference_container)
    .add(EReference_resolveProxies)
    .add(EReference_eOpposite);

// EAttribute
//  - attributes
//      - iD: Boolean

var EAttribute_iD = EAttribute.create({ name: 'iD', eType: EBoolean });
EAttribute.get('eStructuralFeatures').add(EAttribute_iD);

// Set attributes values for EClasses.

EObjectClass.set({ name: 'EObject' });
EModelElement.set({ name: 'EModelElement', abstract: true });
EAnnotation.set({ name: 'EAnnotation' });
ENamedElement.set({ name: 'ENamedElement', abstract: true });
EPackage.set({ name: 'EPackage' });
EClassifier.set({ name: 'EClassifier', abstract: true });
EDataType.set({ name: 'EDataType' });
EEnum.set({ name: 'EEnum' });
ETypedElement.set({ name: 'ETypedElement', abstract: true });
EStructuralFeature.set({ name: 'EStructuralFeature', abstract: true });
EAttribute.set({ name: 'EAttribute' });
EReference.set({ name: 'EReference' });
EOperation.set({ name: 'EOperation' });
EParameter.set({ name: 'EParameter' });
EEnumLiteral.set({ name: 'EEnumLiteral' });

// EOperation
//

var EOperation_eParameters = EReference.create({
    name: 'eParameters',
    eType: EParameter,
    containment: true,
    lowerBound: 0,
    upperBound: -1
});

EOperation.get('eStructuralFeatures').add(EOperation_eParameters);

var EEnum_eLiterals = EReference.create({
    name: 'eLiterals',
    eType: EEnumLiteral,
    containment: true,
    lowerBound: 0,
    upperBound: -1
});

EEnum.get('eStructuralFeatures').add(EEnum_eLiterals);

EEnumLiteral_value = EAttribute.create({
    name: 'value',
    eType: EInt
});

EEnumLiteral_literal = EAttribute.create({
    name: 'literal',
    eType: EString
});

EEnumLiteral.get('eStructuralFeatures')
    .add(EEnumLiteral_literal)
    .add(EEnumLiteral_value);

// DataTypes

EString.eClass = EDataType;
EString.set({ name: 'EString' });
EInt.eClass = EDataType;
EInt.set({ name: 'EInt' });
EBoolean.eClass = EDataType;
EBoolean.set({ name: 'EBoolean' });
EDate.eClass = EDataType;
EDate.set({ name: 'EDate' });
EDouble.eClass = EDataType;
EDouble.set({ name: 'EDouble' });
JSObject.eClass = EDataType;
JSObject.set({ name: 'JSObject' });

Ecore.ELong = EDataType.create({
    name: 'ELong'
});
Ecore.EFloat = EDataType.create({
    name: 'EFloat'
});
Ecore.EShort = EDataType.create({
    name: 'EShort'
});

// EPackage
//  - references
//      - eClassifiers

var EPackage_eClassifiers = EReference.create({
    name: 'eClassifiers',
    lowerBound: 0,
    upperBound: -1,
    containment: true,
    eType: EClassifier
});

var EPackage_eSubPackages = EReference.create({
    name: 'eSubPackages',
    lowerBound: 0,
    upperBound: -1,
    containment: true,
    eType: EPackage
});

EPackage.get('eStructuralFeatures')
    .add(EAttribute.create({ name: 'nsURI', eType: EString }))
    .add(EAttribute.create({ name: 'nsPrefix', eType: EString }))
    .add(EPackage_eClassifiers)
    .add(EPackage_eSubPackages);

// EcorePackage

Ecore.EcorePackage = EPackage.create({
    name: 'ecore',
    nsPrefix: 'ecore',
    nsURI: 'http://www.eclipse.org/emf/2002/Ecore'
});

Ecore.EcorePackage.get('eClassifiers')
    .add(EObjectClass)
    .add(EModelElement)
    .add(EAnnotation)
    .add(ENamedElement)
    .add(EPackage)
    .add(EClassifier)
    .add(EClass)
    .add(EDataType)
    .add(ETypedElement)
    .add(EStructuralFeature)
    .add(EAttribute)
    .add(EReference)
    .add(EOperation)
    .add(EParameter)
    .add(EEnum)
    .add(EEnumLiteral)
    .add(EString)
    .add(EBoolean)
    .add(EInt)
    .add(EDouble)
    .add(EDate)
    .add(Ecore.EShort)
    .add(Ecore.EFloat)
    .add(Ecore.ELong)
    .add(JSObject);

Ecore.EObject = EObjectClass;
Ecore.EModelElement = EModelElement;
Ecore.EClass = EClass;
Ecore.EClassifier = EClassifier;
Ecore.EAnnotation = EAnnotation;
Ecore.EPackage = EPackage;
Ecore.ETypedElement = ETypedElement;
Ecore.ENamedElement = ENamedElement;
Ecore.EStructuralFeature = EStructuralFeature;
Ecore.EAttribute = EAttribute;
Ecore.EReference = EReference;
Ecore.EEnum = EEnum;
Ecore.EEnumLiteral = EEnumLiteral;
Ecore.EDataType = EDataType;
Ecore.EOperation = EOperation;
Ecore.EParameter = EParameter;
Ecore.EString = EString;
Ecore.EBoolean = EBoolean;
Ecore.EInt = EInt;
Ecore.EDouble = EDouble;
Ecore.EDate = EDate;
Ecore.JSObject = JSObject;

// EPackage Registry
//
// Stores all created EPackages

Ecore.EPackage.Registry = {

    _ePackages: {},

    getEPackage: function(nsURI) {
        return this._ePackages[nsURI];
    },

    register: function(ePackage) {
        if (!ePackage.isSet('nsURI')) {
            throw new Error('Cannot register EPackage without nsURI');
        }

        this._ePackages[ePackage.get('nsURI')] = ePackage;
    },

    ePackages: function() {
        return _.values(this._ePackages);
    },

    elements: function(type) {
        var filter = function(el) {
            if (!type) return true;
            else if (type.eClass) {
                return el.eClass === type;
            } else {
                return el.eClass.get('name') === type;
            }
        };

        var ePackages = this.ePackages();
        var content = function(eObject) {
            return _.map(eObject.eContents(), function(c) {
                return [c, content(c)];
            });
        };
        var map = function(p) { return content(p); };
        var contents = [ePackages, _.map(ePackages, map)];
        contents = _.flatten(contents);
        contents = _.filter(contents, filter);

        return contents;
    }

};

// Registers Ecore Package

Ecore.EPackage.Registry.register(Ecore.EcorePackage);

