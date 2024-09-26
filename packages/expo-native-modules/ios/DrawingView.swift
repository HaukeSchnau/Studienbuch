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
}

class DrawingView: UIView {
    
    private var path = UIBezierPath()
    private var points = [CGPoint]() // Array to store touch points
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
        path.cgPath.
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }
    
    private func setup() {
        self.backgroundColor = .white
        self.isMultipleTouchEnabled = false
        path.lineWidth = 5.0
    }
    
    // Calculate the midpoint between two points
    private func midpoint(_ p1: CGPoint, _ p2: CGPoint) -> CGPoint {
        return CGPoint(x: (p1.x + p2.x) / 2.0, y: (p1.y + p2.y) / 2.0)
    }
    
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        points.removeAll() // Clear points
        let point = touch.location(in: self)
        points.append(point) // Store the initial touch point
        path.move(to: point)
    }
    
    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let point = touch.location(in: self)
        points.append(point) // Add each touch point
        
        // Only start drawing after we have at least 2 points (to calculate midpoint)
        if points.count > 1 {
            let midPoint = midpoint(points[points.count - 2], points[points.count - 1])
            path.addQuadCurve(to: midPoint, controlPoint: points[points.count - 2])
            setNeedsDisplay() // Trigger redraw
        }
    }
    
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        points.removeAll()
        setNeedsDisplay() // Ensure the path is updated
    }
    
    override func draw(_ rect: CGRect) {
        UIColor.black.setStroke()
        path.stroke() // Draw the current path
    }
    
    func clear() {
        path.removeAllPoints() // Clear the path
        setNeedsDisplay() // Trigger a redraw
    }
}
