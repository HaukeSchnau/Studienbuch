import ExpoModulesCore
import UIKit

import ExpoModulesCore

class DrawingExpoView: ExpoView {
    private let drawingView = DrawingView()
    
    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        self.addSubview(drawingView)
    }
    
    override func layoutSubviews() {
        super.layoutSubviews()
        drawingView.frame = self.bounds
    }
    
    @objc
    func clear() {
        drawingView.clear()
    }
    
    @objc
    func getSVG() -> String {
        return drawingView.toSVG()
    }
}


class DrawingView: UIView {

    private var currentPath = UIBezierPath()
    private var savedPaths: [UIBezierPath] = [] // Array to store paths
    private var points: [CGPoint] = [] // Array to store touch points
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }
    
    private func setup() {
        self.backgroundColor = .clear
        self.isOpaque = false
        self.isMultipleTouchEnabled = false
        currentPath.lineWidth = 3.0
    }
    
    // Calculate the midpoint between two points
    private func midpoint(_ p1: CGPoint, _ p2: CGPoint) -> CGPoint {
        return CGPoint(x: (p1.x + p2.x) / 2.0, y: (p1.y + p2.y) / 2.0)
    }
    
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        points.removeAll()
        let point = touch.location(in: self)
        points.append(point)
        currentPath.move(to: point)
    }
    
    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let point = touch.location(in: self)
        points.append(point)
        
        if points.count > 1 {
            let midPoint = midpoint(points[points.count - 2], points[points.count - 1])
            currentPath.addQuadCurve(to: midPoint, controlPoint: points[points.count - 2])
            setNeedsDisplay()
        }
    }
    
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        points.removeAll()
        savedPaths.append(currentPath) // Save the current path when touch ends
        currentPath = UIBezierPath() // Start a new path for the next stroke
        currentPath.lineWidth = 5.0
        setNeedsDisplay()
    }
    
    override func draw(_ rect: CGRect) {
        // Set stroke color
        UIColor.black.setStroke()
        
        // Draw all saved paths
        for path in savedPaths {
            path.stroke()
        }
        
        // Draw the current path being drawn
        currentPath.stroke()
    }
    
    // Clear both saved and current paths
    func clear() {
        savedPaths.removeAll()
        currentPath.removeAllPoints()
        setNeedsDisplay()
    }
    
    // Save paths to be reused later
    func getSavedPaths() -> [UIBezierPath] {
        return savedPaths
    }
    
    // Restore paths that were saved earlier
    func setSavedPaths(_ paths: [UIBezierPath]) {
        savedPaths = paths
        setNeedsDisplay() // Redraw the view
    }
    
    func toSVG() -> String {
        let width = Int(self.bounds.width)
        let height = Int(self.bounds.height)
        
        // Start building the SVG string
        var svgString = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"\(width)\" height=\"\(height)\" viewBox=\"0 0 \(width) \(height)\">"
        
        // Add each saved path to the SVG
        for path in savedPaths {
            let svgPath = path.toSVGPath()
            svgString.append("<path d=\"\(svgPath)\" stroke=\"black\" fill=\"none\" stroke-width=\"5\" />")
        }
        
        // Close the SVG string
        svgString.append("</svg>")
        
        return svgString
    }
}