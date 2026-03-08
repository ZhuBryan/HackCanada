"use client";

import { gsap } from "gsap";
import { JSX, useEffect, useRef } from "react";

function lerp(a: number, b: number, n: number): number {
  return (1 - n) * a + n * b;
}

function getLocalPointerPos(
  e: MouseEvent | TouchEvent,
  rect: DOMRect
): { x: number; y: number } {
  let clientX = 0,
    clientY = 0;
  if ("touches" in e && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if ("clientX" in e) {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

function getMouseDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.hypot(dx, dy);
}

class ImageItem {
  public DOM: { el: HTMLDivElement; inner: HTMLDivElement | null } = {
    el: null as unknown as HTMLDivElement,
    inner: null,
  };
  public defaultStyle: gsap.TweenVars = { scale: 1, x: 0, y: 0, opacity: 0 };
  public rect: DOMRect | null = null;
  private resize!: () => void;

  constructor(DOM_el: HTMLDivElement) {
    this.DOM.el = DOM_el;
    this.DOM.inner = this.DOM.el.querySelector(".content__img-inner");
    this.getRect();
    this.initEvents();
  }

  private initEvents() {
    this.resize = () => {
      gsap.set(this.DOM.el, this.defaultStyle);
      this.getRect();
    };
    window.addEventListener("resize", this.resize);
  }

  private getRect() {
    this.rect = this.DOM.el.getBoundingClientRect();
  }
}

/* Variant 1 - simple fade trail with velocity cap */
class ImageTrailEffect {
  private container: HTMLDivElement;
  private DOM: { el: HTMLDivElement };
  private images: ImageItem[];
  private imagesTotal: number;
  private imgPosition: number;
  private zIndexVal: number;
  private activeImagesCount: number;
  private isIdle: boolean;
  private threshold: number;
  private mousePos: { x: number; y: number };
  private lastMousePos: { x: number; y: number };
  private cacheMousePos: { x: number; y: number };
  private maxVelocity: number;

  constructor(container: HTMLDivElement, maxVelocity: number = 600) {
    this.container = container;
    this.DOM = { el: container };
    this.images = [...container.querySelectorAll(".content__img")].map(
      (img) => new ImageItem(img as HTMLDivElement)
    );
    this.imagesTotal = this.images.length;
    this.imgPosition = 0;
    this.zIndexVal = 1;
    this.activeImagesCount = 0;
    this.isIdle = true;
    this.threshold = 80;
    this.mousePos = { x: 0, y: 0 };
    this.lastMousePos = { x: 0, y: 0 };
    this.cacheMousePos = { x: 0, y: 0 };
    this.maxVelocity = maxVelocity;

    const handlePointerMove = (ev: MouseEvent | TouchEvent) => {
      const rect = this.container.getBoundingClientRect();
      const raw = getLocalPointerPos(ev, rect);
      // Cap velocity
      const dx = raw.x - this.mousePos.x;
      const dy = raw.y - this.mousePos.y;
      const dist = Math.hypot(dx, dy);
      if (dist > this.maxVelocity) {
        const scale = this.maxVelocity / dist;
        raw.x = this.mousePos.x + dx * scale;
        raw.y = this.mousePos.y + dy * scale;
      }
      this.mousePos = raw;
    };
    container.addEventListener("mousemove", handlePointerMove);
    container.addEventListener("touchmove", handlePointerMove);

    const initRender = (ev: MouseEvent | TouchEvent) => {
      const rect = this.container.getBoundingClientRect();
      this.mousePos = getLocalPointerPos(ev, rect);
      this.cacheMousePos = { ...this.mousePos };
      requestAnimationFrame(() => this.render());
      container.removeEventListener("mousemove", initRender as EventListener);
      container.removeEventListener("touchmove", initRender as EventListener);
    };
    container.addEventListener("mousemove", initRender as EventListener);
    container.addEventListener("touchmove", initRender as EventListener);
  }

  private render() {
    const distance = getMouseDistance(this.mousePos, this.lastMousePos);
    this.cacheMousePos.x = lerp(this.cacheMousePos.x, this.mousePos.x, 0.1);
    this.cacheMousePos.y = lerp(this.cacheMousePos.y, this.mousePos.y, 0.1);

    if (distance > this.threshold) {
      this.showNextImage();
      this.lastMousePos = { ...this.mousePos };
    }
    if (this.isIdle && this.zIndexVal !== 1) {
      this.zIndexVal = 1;
    }
    requestAnimationFrame(() => this.render());
  }

  private showNextImage() {
    ++this.zIndexVal;
    this.imgPosition =
      this.imgPosition < this.imagesTotal - 1 ? this.imgPosition + 1 : 0;
    const img = this.images[this.imgPosition];

    gsap.killTweensOf(img.DOM.el);
    gsap
      .timeline({
        onStart: () => this.onImageActivated(),
        onComplete: () => this.onImageDeactivated(),
      })
      .fromTo(
        img.DOM.el,
        {
          opacity: 1,
          scale: 0,
          zIndex: this.zIndexVal,
          x: this.cacheMousePos.x - (img.rect?.width ?? 0) / 2,
          y: this.cacheMousePos.y - (img.rect?.height ?? 0) / 2,
        },
        {
          duration: 0.4,
          ease: "power1",
          scale: 1,
          x: this.mousePos.x - (img.rect?.width ?? 0) / 2,
          y: this.mousePos.y - (img.rect?.height ?? 0) / 2,
        },
        0
      )
      .fromTo(
        img.DOM.inner,
        { scale: 2.8, filter: "brightness(250%)" },
        {
          duration: 0.4,
          ease: "power1",
          scale: 1,
          filter: "brightness(100%)",
        },
        0
      )
      .to(
        img.DOM.el,
        {
          duration: 0.4,
          ease: "power2",
          opacity: 0,
          scale: 0.2,
        },
        0.45
      );
  }

  private onImageActivated() {
    this.activeImagesCount++;
    this.isIdle = false;
  }

  private onImageDeactivated() {
    this.activeImagesCount--;
    if (this.activeImagesCount === 0) {
      this.isIdle = true;
    }
  }
}

interface ImageTrailProps {
  items: string[];
  maxVelocity?: number;
  enabled?: boolean;
}

export default function ImageTrail({
  items,
  maxVelocity = 600,
  enabled = true,
}: ImageTrailProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !enabled) return;
    new ImageTrailEffect(containerRef.current, maxVelocity);
  }, [items, maxVelocity, enabled]);

  return (
    <div
      className="w-full h-full relative z-[100] rounded-lg bg-transparent overflow-visible"
      ref={containerRef}
    >
      {items.map((url, i) => (
        <div
          className="content__img w-[190px] aspect-[1.1] rounded-[15px] absolute top-0 left-0 opacity-0 overflow-hidden [will-change:transform,filter]"
          key={i}
        >
          <div
            className="content__img-inner bg-center bg-cover w-[calc(100%+20px)] h-[calc(100%+20px)] absolute top-[-10px] left-[-10px]"
            style={{ backgroundImage: `url(${url})` }}
          />
        </div>
      ))}
    </div>
  );
}
