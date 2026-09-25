import sys, re, math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage as ndi

def noise(shape, scale, seed):
    rng=np.random.default_rng(seed)
    small=rng.random((shape[0]//scale+2, shape[1]//scale+2))
    z=ndi.zoom(small, scale, order=3)[:shape[0],:shape[1]]
    return (z-z.min())/(z.max()-z.min()+1e-9)

def spikes(mask, n, lo, hi, seed, taper=0.06):
    """grow tapered spikes outward from edge along local normal"""
    rng=np.random.default_rng(seed)
    H,W=mask.shape
    dist=ndi.distance_transform_edt(~mask)
    gy,gx=np.gradient(ndi.gaussian_filter(mask.astype(float),6))
    edge=mask & ~ndi.binary_erosion(mask,iterations=2)
    ys,xs=np.where(edge)
    idx=rng.choice(len(ys), size=min(n,len(ys)), replace=False)
    out=Image.fromarray(mask.astype(np.uint8)*255)
    d=ImageDraw.Draw(out)
    for i in idx:
        y,x=ys[i],xs[i]
        nx,ny=-gx[y,x],-gy[y,x]; L=math.hypot(nx,ny)
        if L<1e-4: continue
        nx/=L; ny/=L
        ang=math.atan2(ny,nx)+rng.normal(0,0.25)
        length=rng.uniform(lo,hi); w=length*taper+3
        # bias: bottom edges become drips (straight down), top edges longer
        if ny>0.6: ang=math.pi/2+rng.normal(0,0.08); length*=1.3
        tip=(x+math.cos(ang)*length, y+math.sin(ang)*length)
        px,py=-math.sin(ang)*w, math.cos(ang)*w
        d.polygon([(x-px*1.5,y-py*1.5),(x+px*1.5,y+py*1.5),tip],fill=255)
    return np.array(out)>127

def render(text, font_path, fontsize, seed=7, W=5200, H=2400, reach=1.0):
    """reach scales the crown/drip blades and the top/bottom mass spikes:
    1.0 for the deck mark, ~0.8 for the door mark so it sits as wide-and-low
    as the other doors' marks. Same seed → same spike positions."""
    font=ImageFont.truetype(font_path, fontsize)
    img=Image.new('L',(W,H),0); d=ImageDraw.Draw(img)
    bb=d.textbbox((0,0),text,font=font)
    tw,th=bb[2]-bb[0],bb[3]-bb[1]
    d.text(((W-tw)/2-bb[0],(H-th)/2-bb[1]),text,font=font,fill=255)
    core=np.array(img)>127
    # letter warp: subtle displacement so it reads hand-cut
    n1=noise((H,W),90,seed); n2=noise((H,W),90,seed+1)
    yy,xx=np.mgrid[0:H,0:W]
    core=ndi.map_coordinates(core.astype(float),[yy+(n1-.5)*18, xx+(n2-.5)*12],order=1)>0.5
    # sharpen letter ends into points: erode+dilate pass with noise threshold
    core=ndi.binary_closing(core,iterations=3)
    # cracks through letters (bright core has dark veins in Stretty)
    veins=(noise((H,W),22,seed+2)>0.47)&(noise((H,W),22,seed+2)<0.50)
    core_cracked=core & ~ndi.binary_dilation(veins,iterations=1)
    # spikes off letters (these belong to core)
    core_sp=spikes(core, 80, 40, 200, seed+3, taper=0.04)
    core_sp=ndi.binary_closing(core_sp,iterations=2)|core_cracked
    # mass: organic cloud around letters
    rng=np.random.default_rng(seed+40)
    mass0=ndi.binary_dilation(core,iterations=125)
    dm=ndi.distance_transform_edt(mass0)
    mass=mass0 & (dm > 70*noise((H,W),60,seed+9))
    mass=ndi.binary_opening(mass,iterations=2)
    edge=mass & ~ndi.binary_erosion(mass,iterations=2)
    ys,xs=np.where(edge); cy=ys.mean(); cx=xs.mean()
    img=Image.fromarray(mass.astype(np.uint8)*255); d=ImageDraw.Draw(img)
    def sector(cond,n,lo,hi,ang_fn,jit,taper):
        pts=np.where(cond)[0]
        if len(pts)==0: return
        for i in rng.choice(pts,size=min(n,len(pts)),replace=False):
            y,x=ys[i],xs[i]; ang=ang_fn(y,x)+rng.normal(0,jit); L=rng.uniform(lo,hi); w=L*taper+4
            px,py=-math.sin(ang)*w,math.cos(ang)*w
            d.polygon([(x-px,y-py),(x+px,y+py),(x+math.cos(ang)*L,y+math.sin(ang)*L)],fill=255)
    top=ys<cy-0.25*(ys.max()-ys.min()); bot=ys>cy+0.25*(ys.max()-ys.min())
    left=xs<xs.min()+0.08*(xs.max()-xs.min()); right=xs>xs.max()-0.08*(xs.max()-xs.min())
    sector(top,14,220*reach,560*reach,lambda y,x:-math.pi/2+(x-cx)/(xs.max()-cx)*0.5,0.12,0.07)
    sector(bot,26,150*reach,480*reach,lambda y,x:math.pi/2,0.05,0.05)
    sector(left,6,250,560,lambda y,x:math.pi+ (y-cy)/(ys.max()-cy)*0.5,0.15,0.06)
    sector(right,6,250,560,lambda y,x:(y-cy)/(ys.max()-cy)*0.5,0.15,0.06)
    sector(np.ones(len(ys),bool),220,25,140,lambda y,x:math.atan2(y-cy,(x-cx)*0.5),0.35,0.1)
    mass=np.array(img)>127
    mass=mass & (noise((H,W),9,seed+7)>0.07)   # web holes
    mass=mass|core_sp
    # vein network inside mass (bright)
    nw=noise((H,W),36,seed+8); nw2=noise((H,W),18,seed+12); web=(((nw>0.49)&(nw<0.506))|((nw2>0.495)&(nw2<0.505)))&mass&~ndi.binary_dilation(core,iterations=6)
    web=ndi.binary_dilation(web,iterations=1)&mass
    # embedded centre designs: crown spike top, drip spike bottom, flanking blades, cracks radiating through letters
    cy_,cx_=[v.mean() for v in np.where(core)]
    ty=np.where(core)[0].min(); by=np.where(core)[0].max()
    dimg=Image.new('L',(W,H),0); dd=ImageDraw.Draw(dimg)
    def blade(x0,y0,ang,L,w):
        px,py=-math.sin(ang)*w,math.cos(ang)*w
        dd.polygon([(x0-px,y0-py),(x0+px,y0+py),(x0+math.cos(ang)*L,y0+math.sin(ang)*L)],fill=255)
    # top crown
    blade(cx_,cy_-40,-math.pi/2,((cy_-ty)+620)*reach,26)
    for k,(dx,L,a) in enumerate([(-150,380,-1.75),(150,380,-1.39),(-330,300,-1.95),(330,300,-1.19)]):
        blade(cx_+dx,ty+10,a,L*reach,14)
    # bottom drip
    blade(cx_,cy_+40,math.pi/2,((by-cy_)+700)*reach,26)
    for dx,L,a in [(-180,420,1.62),(180,420,1.52),(-380,320,1.72),(380,320,1.42)]:
        blade(cx_+dx,by-10,a,L*reach,13)
    # horizontal cracks through the letters (Stretty-style)
    rng2=np.random.default_rng(seed+77)
    cimg=Image.new('L',(W,H),0); cd=ImageDraw.Draw(cimg)
    for _ in range(7):
        x=cx_+rng2.uniform(-0.45,0.45)*W*0.5; y=cy_+rng2.uniform(-0.6,0.6)*(by-ty)/2
        ang=rng2.choice([0,math.pi])+rng2.normal(0,0.35)
        L=rng2.uniform(200,700)
        pts=[(x,y)]
        for i in range(8):
            x+=math.cos(ang)*L/8; y+=math.sin(ang)*L/8; ang+=rng2.normal(0,0.35); pts.append((x,y))
        cd.line(pts,fill=255,width=3)
    design=np.array(dimg)>127
    design=(spikes(design,50,20,80,seed+78,taper=0.12)&~ndi.binary_dilation(core,iterations=4))|design
    cracks=np.array(cimg)>127
    core_final=(core_sp|web|design|(cracks&mass&~core))&~(cracks&core)   # cracks bright in mass, dark through letters
    mass=mass|ndi.binary_dilation(design,iterations=18)
    return mass, core_final, core

def save_pbm(m,p): Image.fromarray(np.where(m,0,255).astype(np.uint8)).convert('1').save(p)

def build_svg(layers,out):
    def parts(f):
        s=open(f).read()
        return (re.search(r'(<g[^>]*>.*</g>)',s,re.S).group(1),re.search(r'viewBox="([^"]+)"',s).group(1),*re.search(r'width="([^"]+)" height="([^"]+)"',s).groups())
    _,vb,w,h=parts(layers[0][0]); body=''
    for f,c in layers:
        g,_,_,_=parts(f); body+=g.replace('fill="#000000"',f'fill="{c}"')+'\n'
    open(out,'w').write(f'<?xml version="1.0" standalone="no"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}" preserveAspectRatio="xMidYMid meet">\n{body}</svg>\n')

def trace(mask,path):
    save_pbm(mask,path+'.pbm')
    subprocess.run(['potrace',path+'.pbm','-s','-o',path+'.svg','--turdsize','3','--alphamax','1','--opttolerance','0.2'],check=True)
    return path+'.svg'

if __name__=='__main__':
    # usage: deathlogo.py TEXT name '#mass' '#ink' seed [font.ttf|-] [door_reach]
    # writes name-logo.svg (deck h1), name-hollow-logo.svg (roster door,
    # rendered again at door_reach — 0.8 for HEXBOY / GRAVEBOY),
    # name-lineart.svg and name-hd-transparent.png next to the cwd.
    text,name,dark,light,seed=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4],int(sys.argv[5])
    import os
    font=sys.argv[6] if len(sys.argv)>6 and sys.argv[6]!='-' else os.path.join(os.path.dirname(os.path.abspath(__file__)),'src','MetalMania-Regular.ttf')
    door_reach=float(sys.argv[7]) if len(sys.argv)>7 else 1.0
    def crop(mass,*rest):
        ys,xs=np.where(mass); pad=40
        y0,y1,x0,x1=max(ys.min()-pad,0),ys.max()+pad,max(xs.min()-pad,0),xs.max()+pad
        return [m[y0:y1,x0:x1] for m in (mass,)+rest]
    mass,core,glyph=crop(*render(text,font,520,seed))
    outline=ndi.binary_dilation(core,iterations=6)
    layers={l:trace(m,f'{name}-{l}') for l,m in (('mass',mass),('core',core),('outline',outline))}
    build_svg([(layers['mass'],dark),(layers['outline'],'#000000'),(layers['core'],light)],f'{name}-logo.svg')
    build_svg([(layers['core'],'currentColor')],f'{name}-lineart.svg')
    # hollow: the letter interiors are cut out of every layer so the door
    # art shows through; what is left of each glyph is its light rim
    dmass,dcore,dglyph=(mass,core,glyph) if door_reach==1.0 else crop(*render(text,font,520,seed,reach=door_reach))
    doutline=ndi.binary_dilation(dcore,iterations=6)
    inner=ndi.binary_erosion(dglyph,iterations=14)
    hollow={l:trace(m&~inner,f'{name}-hollow-{l}') for l,m in (('mass',dmass),('core',dcore),('outline',doutline))}
    build_svg([(hollow['mass'],dark),(hollow['outline'],'#000000'),(hollow['core'],light)],f'{name}-hollow-logo.svg')
    # HD png with soft fade on mass edge
    hx=lambda s: np.array([int(s[i:i+2],16) for i in (1,3,5)],float)
    a=ndi.gaussian_filter(mass.astype(float),1.2); a=np.clip(a*1.4,0,1)
    t=ndi.gaussian_filter(core.astype(float),0.8)[...,None]
    o=ndi.gaussian_filter(outline.astype(float),0.8)[...,None]
    rgb=hx(dark)*(1-o)+np.zeros(3)*o
    rgb=rgb*(1-np.clip(t,0,1))+hx(light)*np.clip(t,0,1)
    a=np.maximum(a,o[...,0])
    Image.fromarray(np.concatenate([rgb,(a*255)[...,None]],2).astype(np.uint8),'RGBA').save(f'{name}-hd-transparent.png')
    print(name, mass.shape)
