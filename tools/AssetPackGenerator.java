import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Random;

/** Reproducibly creates the original Cirrus UI art with only the JDK AWT renderer. */
public final class AssetPackGenerator {
    private static final int NAVY = 0xff070c18;
    private static final int BLUE = 0xff2367e8;
    private static final int CYAN = 0xff5ad8ff;
    private static final int WHITE = 0xfff2f8ff;
    private static final int ICONS = 16;
    private AssetPackGenerator() { }

    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length == 0 ? "assets/cirrus-client/v1" : args[0]);
        create(root.resolve("backgrounds/main-menu-ambient.png"), mainMenu());
        create(root.resolve("backgrounds/dashboard-ambient.png"), dashboard());
        create(root.resolve("textures/glass-panel-frame.png"), panelFrame());
        create(root.resolve("textures/button-states.png"), buttons());
        create(root.resolve("icons/ui-symbols.png"), iconAtlas());
        create(root.resolve("animations/loading-ring.png"), loadingFrames());
        create(root.resolve("illustrations/empty-library.png"), emptyLibrary());
        Files.writeString(root.resolve("icons/ui-symbols.svg"), iconSvgSource());
    }

    private static BufferedImage image(int w, int h) { return new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB); }
    private static Graphics2D graphics(BufferedImage img) {
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
        return g;
    }
    private static void create(Path path, BufferedImage image) throws IOException {
        Files.createDirectories(path.getParent());
        ImageIO.write(image, "png", path.toFile());
    }

    private static BufferedImage mainMenu() {
        int w=2048,h=1152; BufferedImage img=image(w,h); Graphics2D g=graphics(img);
        g.setPaint(new GradientPaint(0,0,new Color(8,13,27),w,h,new Color(7,10,22))); g.fillRect(0,0,w,h);
        glow(g, w*.22f,h*.56f,w*.42f,new Color(29,83,194,85));
        glow(g,w*.78f,h*.24f,w*.30f,new Color(15,181,221,62));
        glow(g,w*.62f,h*.82f,w*.36f,new Color(67,53,162,50));
        g.setComposite(AlphaComposite.SrcOver);
        g.setStroke(new BasicStroke(3.0f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setPaint(new GradientPaint(140,780,new Color(40,109,226,0),960,210,new Color(68,202,255,38)));
        g.draw(new CubicCurve2D.Float(-180,870,360,440,690,1040,1230,512));
        g.setStroke(new BasicStroke(2.0f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setPaint(new GradientPaint(860,970,new Color(74,130,245,0),1850,180,new Color(57,205,255,34)));
        g.draw(new CubicCurve2D.Float(520,1220,1110,730,1210,880,2220,90));
        Random random=new Random(0xC1A055L);
        for(int i=0;i<420;i++){
            float x=random.nextFloat()*w,y=random.nextFloat()*h,r=.6f+random.nextFloat()*1.5f;
            int alpha=8+random.nextInt(19);g.setColor(new Color(123,198,255,alpha));g.fill(new Ellipse2D.Float(x,y,r,r));
        }
        g.dispose(); return img;
    }
    private static void glow(Graphics2D g,float cx,float cy,float radius,Color color) {
        float[] stops={0f, .22f, .62f, 1f};
        Color transparent=new Color(color.getRed(),color.getGreen(),color.getBlue(),0);
        Color[] colors={new Color(color.getRed(),color.getGreen(),color.getBlue(),color.getAlpha()),
            new Color(color.getRed(),color.getGreen(),color.getBlue(),color.getAlpha()*2/3),
            new Color(color.getRed(),color.getGreen(),color.getBlue(),color.getAlpha()/4),transparent};
        g.setPaint(new RadialGradientPaint(new Point2D.Float(cx,cy),radius,stops,colors));
        g.fill(new Ellipse2D.Float(cx-radius,cy-radius,radius*2,radius*2));
    }
    private static BufferedImage dashboard() {
        int w=1600,h=900;BufferedImage img=image(w,h);Graphics2D g=graphics(img);
        glow(g,1250,300,310,new Color(43,163,240,45));glow(g,1080,680,260,new Color(51,91,225,34));
        g.setComposite(AlphaComposite.SrcOver);
        for(int i=0;i<5;i++){
            g.setColor(new Color(80,193,255,17-i*2));g.setStroke(new BasicStroke(1.4f));
            g.draw(new Ellipse2D.Float(1060+i*18,125+i*18,360-i*36,360-i*36));
        }
        g.setStroke(new BasicStroke(2f));g.setColor(new Color(91,210,255,22));
        g.draw(new CubicCurve2D.Float(690,790,970,560,1150,940,1630,510));
        g.dispose();return img;
    }
    private static BufferedImage panelFrame() {
        int n=96;BufferedImage img=image(n,n);Graphics2D g=graphics(img);
        g.setPaint(new GradientPaint(0,0,new Color(178,226,255,105),n,n,new Color(105,155,231,48)));
        g.setStroke(new BasicStroke(2.2f));g.draw(new RoundRectangle2D.Float(2,2,n-4,n-4,25,25));
        g.setColor(new Color(255,255,255,28));g.setStroke(new BasicStroke(1));g.draw(new RoundRectangle2D.Float(5,5,n-10,n-10,21,21));
        g.setPaint(new GradientPaint(16,5,new Color(255,255,255,50),n-16,5,new Color(255,255,255,0)));
        g.draw(new Line2D.Float(22,4,n-22,4));g.dispose();return img;
    }
    private static BufferedImage buttons() {
        int sw=128,h=64;BufferedImage img=image(sw*3,h);Graphics2D g=graphics(img);
        for(int state=0;state<3;state++){
            int x=state*sw;Color edge=state==2?new Color(102,218,255,188):state==1?new Color(70,167,255,145):new Color(168,199,237,74);
            Color fill=state==2?new Color(44,121,232,26):state==1?new Color(76,145,223,22):new Color(153,183,227,12);
            g.setPaint(new GradientPaint(x,0,fill,x,h,new Color(fill.getRed(),fill.getGreen(),fill.getBlue(),fill.getAlpha()/2)));
            g.fill(new RoundRectangle2D.Float(x+1.5f,1.5f,sw-3,h-3,18,18));
            g.setStroke(new BasicStroke(state==2?2.0f:1.4f));g.setColor(edge);g.draw(new RoundRectangle2D.Float(x+1.5f,1.5f,sw-3,h-3,18,18));
            g.setPaint(new GradientPaint(x+20,3,new Color(255,255,255,state==1?46:state==2?68:25),x+sw-20,3,new Color(255,255,255,0)));
            g.draw(new Line2D.Float(x+19,3,x+sw-19,3));
        }
        g.dispose();return img;
    }
    private static BufferedImage iconAtlas() {
        int cell=64,rows=4;BufferedImage img=image(ICONS*cell,rows*cell);Graphics2D g=graphics(img);
        Color[] colors={new Color(170,190,216),new Color(73,202,255),new Color(23,42,68),new Color(255,190,66)};
        for(int row=0;row<rows;row++)for(int i=0;i<ICONS;i++){
            Graphics2D icon=(Graphics2D)g.create(i*cell,row*cell,cell,cell);
            icon.setColor(colors[row]);icon.setStroke(new BasicStroke(3.4f,BasicStroke.CAP_ROUND,BasicStroke.JOIN_ROUND));drawIcon(icon,i);icon.dispose();
        }
        g.dispose();return img;
    }
    private static void drawIcon(Graphics2D g,int k) {
        switch(k){
            case 0 -> {g.drawRoundRect(13,13,15,15,5,5);g.drawRoundRect(36,13,15,15,5,5);g.drawRoundRect(13,36,15,15,5,5);g.drawRoundRect(36,36,15,15,5,5);}
            case 1 -> {g.drawRoundRect(14,15,36,34,9,9);g.drawLine(22,24,42,24);g.drawLine(22,32,42,32);g.drawLine(22,40,35,40);}
            case 2 -> {g.drawRoundRect(14,13,36,38,8,8);g.drawLine(22,23,42,23);g.drawLine(22,31,42,31);g.drawLine(22,39,36,39);}
            case 3 -> {g.draw(new Arc2D.Float(12,12,40,40,35,290,Arc2D.OPEN));g.drawLine(32,12,32,32);g.drawLine(32,32,48,32);g.draw(new Arc2D.Float(22,22,20,20,0,180,Arc2D.OPEN));}
            case 4 -> {g.drawOval(14,14,30,30);g.drawLine(39,39,52,52);}
            case 5 -> {Path2D star=new Path2D.Float();for(int i=0;i<10;i++){double a=-Math.PI/2+i*Math.PI/5;double r=i%2==0?20:9;double x=32+Math.cos(a)*r,y=32+Math.sin(a)*r;if(i==0)star.moveTo(x,y);else star.lineTo(x,y);}star.closePath();g.draw(star);}
            case 6 -> {g.drawRoundRect(13,13,38,38,10,10);g.drawLine(32,5,32,21);g.drawLine(32,43,32,59);g.drawLine(5,32,21,32);g.drawLine(43,32,59,32);}
            case 7 -> {g.drawOval(11,11,42,42);g.drawOval(21,21,22,22);g.drawOval(28,28,8,8);}
            case 8 -> {g.draw(new Arc2D.Float(8,17,48,31,0,180,Arc2D.OPEN));g.drawOval(27,26,10,10);}
            case 9 -> {g.drawLine(12,51,12,14);g.drawLine(12,51,53,51);g.draw(new CubicCurve2D.Float(16,43,23,24,30,48,36,30));g.draw(new CubicCurve2D.Float(36,30,42,15,47,31,52,14));}
            case 10 -> {g.drawRoundRect(14,14,36,36,8,8);g.drawLine(23,23,41,41);g.drawLine(41,23,23,41);g.drawOval(27,27,10,10);}
            case 11 -> {g.drawRoundRect(11,13,42,38,8,8);g.drawLine(11,24,53,24);g.drawOval(20,31,6,6);g.drawOval(37,31,6,6);}
            case 12 -> {g.drawRoundRect(11,15,42,34,9,9);g.drawLine(21,39,43,39);g.drawLine(24,20,24,15);g.drawLine(40,20,40,15);}
            case 13 -> {g.drawRoundRect(10,14,44,34,8,8);g.drawLine(32,14,32,5);g.drawOval(28,3,8,8);g.drawLine(18,48,18,55);g.drawLine(46,48,46,55);}
            case 14 -> {g.drawLine(47,32,17,32);g.drawLine(17,32,30,19);g.drawLine(17,32,30,45);}
            default -> {g.drawLine(18,18,46,46);g.drawLine(46,18,18,46);}
        }
    }
    private static BufferedImage loadingFrames() {
        int cell=64;BufferedImage img=image(cell*8,cell);Graphics2D g=graphics(img);
        for(int i=0;i<8;i++){
            Graphics2D f=(Graphics2D)g.create(i*cell,0,cell,cell);f.rotate(i*Math.PI/4,32,32);
            f.setStroke(new BasicStroke(4.5f,BasicStroke.CAP_ROUND,BasicStroke.JOIN_ROUND));
            f.setColor(new Color(76,206,255,48));f.draw(new Arc2D.Float(10,10,44,44,40,286,Arc2D.OPEN));
            f.setColor(new Color(99,224,255,235));f.draw(new Arc2D.Float(10,10,44,44,40,82,Arc2D.OPEN));
            f.setColor(new Color(113,153,255,128));f.fill(new Ellipse2D.Float(29,6,6,6));f.dispose();
        }
        g.dispose();return img;
    }
    private static BufferedImage emptyLibrary() {
        BufferedImage img=image(640,384);Graphics2D g=graphics(img);
        glow(g,320,190,132,new Color(39,117,233,42));g.setColor(new Color(70,157,235,145));g.setStroke(new BasicStroke(3.0f));
        g.draw(new RoundRectangle2D.Float(206,91,228,166,21,21));g.setColor(new Color(164,212,255,95));g.draw(new RoundRectangle2D.Float(216,101,208,146,15,15));
        g.setColor(new Color(76,203,255,210));g.setStroke(new BasicStroke(4.0f));g.draw(new Ellipse2D.Float(273,126,94,94));
        g.setColor(new Color(143,225,255,170));g.draw(new Ellipse2D.Float(292,145,56,56));
        g.setStroke(new BasicStroke(3));g.draw(new Line2D.Float(306,173,334,173));g.draw(new Line2D.Float(320,159,320,187));
        g.setColor(new Color(142,186,239,100));g.fill(new Ellipse2D.Float(161,141,9,9));g.fill(new Ellipse2D.Float(467,124,7,7));g.fill(new Ellipse2D.Float(458,237,11,11));
        g.dispose();return img;
    }

    private static String iconSvgSource() {
        return """
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 64" fill="none" stroke="#49caff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
              <g transform="translate(0)"><rect x="13" y="13" width="15" height="15" rx="5"/><rect x="36" y="13" width="15" height="15" rx="5"/><rect x="13" y="36" width="15" height="15" rx="5"/><rect x="36" y="36" width="15" height="15" rx="5"/></g>
              <g transform="translate(64)"><rect x="14" y="15" width="36" height="34" rx="9"/><path d="M22 24h20M22 32h20M22 40h13"/></g>
              <g transform="translate(128)"><rect x="14" y="13" width="36" height="38" rx="8"/><path d="M22 23h20M22 31h20M22 39h14"/></g>
              <g transform="translate(192)"><path d="M32 12v20h16M22 22a20 20 0 1 0 20-10"/></g>
              <g transform="translate(256)"><circle cx="29" cy="29" r="15"/><path d="m40 40 12 12"/></g>
              <g transform="translate(320)"><path d="m32 10 6 14 15 1-11 10 3 15-13-8-13 8 3-15-11-10 15-1z"/></g>
              <g transform="translate(384)"><rect x="13" y="13" width="38" height="38" rx="10"/><path d="M32 5v16M32 43v16M5 32h16M43 32h16"/></g>
              <g transform="translate(448)"><circle cx="32" cy="32" r="21"/><circle cx="32" cy="32" r="11"/><circle cx="32" cy="32" r="4"/></g>
              <g transform="translate(512)"><path d="M8 33a24 24 0 0 1 48 0M8 33c12 14 36 14 48 0"/><circle cx="32" cy="32" r="5"/></g>
              <g transform="translate(576)"><path d="M12 51V14M12 51h41M16 43c7-19 14 5 20-13s11 1 16-16"/></g>
              <g transform="translate(640)"><rect x="14" y="14" width="36" height="36" rx="8"/><path d="m23 23 18 18M41 23 23 41"/><circle cx="32" cy="32" r="5"/></g>
              <g transform="translate(704)"><rect x="11" y="13" width="42" height="38" rx="8"/><path d="M11 24h42"/><circle cx="23" cy="35" r="3"/><circle cx="40" cy="35" r="3"/></g>
              <g transform="translate(768)"><rect x="11" y="15" width="42" height="34" rx="9"/><path d="M24 20v-5M40 20v-5M21 39h22"/></g>
              <g transform="translate(832)"><rect x="10" y="14" width="44" height="34" rx="8"/><path d="M32 14V5M28 5h8M18 48v7M46 48v7"/></g>
              <g transform="translate(896)"><path d="M47 32H17m0 0 13-13m-13 13 13 13"/></g>
              <g transform="translate(960)"><path d="m18 18 28 28m0-28L18 46"/></g>
            </svg>
            """;
    }
}

