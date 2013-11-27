/**
 * @fileoverview Tests for navigation-related core functions.
 */

goog.require('spf');
goog.require('spf.history');
goog.require('spf.nav');
goog.require('spf.nav.request');
goog.require('spf.url');


describe('spf.nav', function() {

  var MOCK_DELAY = 10;
  var objFunc = function() { return {}; };
  var nullFunc = function() { return null; };
  var createFakeBrowserEvent = function() {
    var target = {
      href: 'SPF_HREF'
    };
    var evt = {
      metaKey: false,
      altKey: false,
      ctrlKey: false,
      shiftKey: false,
      target: target,
      defaultPrevented: false,
      preventDefault: function() { evt.defaultPrevented = true; }
    };
    return evt;
  };
  var createFakeRequest = function(response1, response2) {
    var counter = 0;
    var xhr = {
      abort: function() { },
      readyState: 1
    };
    var callOnSuccessDelayed = function(url, opts) {
      setTimeout(function() {
        if (counter == 0) {
          opts.onSuccess(url, response1);
          counter++;
        } else {
          opts.onSuccess(url, response2);
        }
        xhr.readyState = 4;
      }, MOCK_DELAY);
    };
    return function(url, options) {
      callOnSuccessDelayed(url, options);
      return xhr;
    };
  };


  beforeEach(function() {
    spyOn(spf.history, 'add');
    spyOn(spf.history, 'replace');
    if (!document.addEventListener) {
      document.addEventListener = jasmine.createSpy('addEventListener');
    }

    spf.nav.init();
    jasmine.Clock.useMock();
  });


  afterEach(function() {
    spf.nav.dispose();
    spf.config.clear();
  });


  describe('prefetch', function() {


    it('prefetches a page', function() {
      var url = '/page';
      var fake = createFakeRequest({'title': 'my title'});
      spyOn(spf.nav.request, 'send').andCallFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);
      var prefetches = spf.nav.prefetches_();
      expect(prefetches[absoluteUrl]).toBeTruthy();

      jasmine.Clock.tick(MOCK_DELAY + 1);
      expect(prefetches[absoluteUrl]).not.toBeTruthy();
    });


    it('promotes a prefetch', function() {
      spyOn(spf.nav, 'handleNavigateSuccess_');

      var url = '/page';
      var fake = createFakeRequest({'title': 'my title'});
      spyOn(spf.nav.request, 'send').andCallFake(fake);


      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);
      spf.nav.navigate(url);
      expect(spf.state.get('nav-promote')).toEqual(url);

      jasmine.Clock.tick(MOCK_DELAY + 1);
      expect(spf.nav.handleNavigateSuccess_).toHaveBeenCalled();
    });


    it('prefetch with redirects', function() {
      spyOn(spf.nav, 'prefetch_').andCallThrough();

      var url = '/page';
      var url2 = '/page2';
      var fake = createFakeRequest({'redirect': url2}, {'title': 'my title'});
      spyOn(spf.nav.request, 'send').andCallFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);

      jasmine.Clock.tick(2 * MOCK_DELAY + 1);
      expect(spf.nav.prefetch_.calls[1].args[0]).toEqual(url2);
      expect(spf.nav.prefetch_.calls.length).toEqual(2);
    });


    it('promotes a prefetch with redirects', function() {
      spyOn(spf.nav, 'prefetch').andCallThrough();
      spyOn(spf.nav, 'handleNavigateSuccess_');

      var url = '/page';
      var url2 = '/page2';
      var fake = createFakeRequest({'redirect': url2}, {'title': 'my title'});
      spyOn(spf.nav.request, 'send').andCallFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);
      jasmine.Clock.tick(MOCK_DELAY + 1);
      spf.nav.navigate(url);

      jasmine.Clock.tick(MOCK_DELAY + 1);
      expect(spf.nav.handleNavigateSuccess_).toHaveBeenCalled();
    });


  });


  describe('handleClick_', function() {


    beforeEach(function(argument) {
      spyOn(spf.nav, 'navigate_');
    });


    it('ignores click with modifier keys', function() {
      var evt = createFakeBrowserEvent();

      evt.metaKey = true;
      spf.nav.handleClick_(evt);

      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click with alternative button', function() {
      var evt = createFakeBrowserEvent();

      evt.button = 1;
      spf.nav.handleClick_(evt);

      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click with nolink class', function() {
      spyOn(spf.nav, 'getAncestorWithNoLinkClass_').andCallFake(objFunc);
      spf.config.set('nolink-class', 'NOLINK_CLASS');

      var evt = createFakeBrowserEvent();
      spf.nav.handleClick_(evt);

      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click without href', function() {
      spyOn(spf.nav, 'getAncestorWithHref_').andCallFake(nullFunc);
      spyOn(spf.nav, 'getAncestorWithLinkClass_').andCallFake(objFunc);

      var evt = createFakeBrowserEvent();
      spf.nav.handleClick_(evt);

      expect(spf.nav.getAncestorWithHref_).toHaveBeenCalled();
      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click without link class', function() {
      spyOn(spf.nav, 'getAncestorWithLinkClass_').andCallFake(nullFunc);

      var evt = createFakeBrowserEvent();
      spf.nav.handleClick_(evt);

      expect(spf.nav.getAncestorWithLinkClass_).toHaveBeenCalled();
      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('handles spf click', function() {
      var evt = createFakeBrowserEvent();
      spyOn(spf.nav, 'getAncestorWithHref_').andCallFake(function() {
          return {href: evt.target.href}; });
      spyOn(spf.nav, 'getAncestorWithLinkClass_').andCallFake(objFunc);

      spf.nav.handleClick_(evt);

      expect(evt.defaultPrevented).toEqual(true);
      expect(spf.nav.navigate_).toHaveBeenCalledWith(evt.target.href);
    });


  });


});
